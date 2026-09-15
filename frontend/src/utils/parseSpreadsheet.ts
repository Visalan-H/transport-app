/**
 * Dependency-free reader for the files an admin is likely to upload when bulk
 * inviting: .csv/.tsv/plain text, and the ZIP-based office formats .xlsx and
 * .ods. It deliberately pulls in no third-party parser -- the popular one
 * (SheetJS `xlsx`) ships known prototype-pollution and ReDoS advisories on npm,
 * and feeding it admin-uploaded files is exactly the risk those describe.
 *
 * We never need to reconstruct the spreadsheet's grid. The caller only wants
 * the email-shaped tokens out of it, so this returns one flat blob of every
 * bit of text in the file; parseEmailText picks the addresses out and ignores
 * the rest (numbers, headers, names). That lets one code path cover every
 * layout -- a bare email column, "Name, Email, Roll No", multiple sheets.
 *
 * This module is imported dynamically (only when an admin actually picks a
 * file), so its cost never lands in the bundle a student downloads.
 */

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

const looksLikeZip = (bytes: Uint8Array): boolean => ZIP_MAGIC.every((b, i) => bytes[i] === b);

/** Inflate a raw DEFLATE stream (ZIP compression method 8) via the platform. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
    // Copied into its own buffer first: the input is a subarray view over the
    // whole file, and Blob wants an ArrayBuffer-backed part, not a view that
    // might alias a SharedArrayBuffer.
    const part = new Uint8Array(bytes);
    const stream = new Blob([part]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface ZipEntry {
    name: string;
    method: number;
    compressedSize: number;
    localHeaderOffset: number;
}

/**
 * Walks the ZIP central directory rather than the local file headers: entries
 * written with a streaming data descriptor leave their sizes as zero in the
 * local header, and only the central directory is authoritative. Only enough
 * of the format is parsed to find and inflate the XML parts we care about --
 * no ZIP64, which small office documents never need.
 */
function readCentralDirectory(view: DataView, bytes: Uint8Array): ZipEntry[] {
    const EOCD_SIG = 0x06054b50;
    const CDH_SIG = 0x02014b50;

    // The End Of Central Directory record lives at the tail, after an optional
    // comment of up to 65535 bytes -- scan back across that window for it.
    let eocd = -1;
    const minEnd = Math.max(0, bytes.length - (0xffff + 22));
    for (let i = bytes.length - 22; i >= minEnd; i--) {
        if (view.getUint32(i, true) === EOCD_SIG) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP archive (no end-of-central-directory record).');

    const count = view.getUint16(eocd + 10, true);
    let ptr = view.getUint32(eocd + 16, true); // offset of first central-directory header

    const entries: ZipEntry[] = [];
    for (let i = 0; i < count; i++) {
        if (view.getUint32(ptr, true) !== CDH_SIG) break;
        const method = view.getUint16(ptr + 10, true);
        const compressedSize = view.getUint32(ptr + 20, true);
        const nameLen = view.getUint16(ptr + 28, true);
        const extraLen = view.getUint16(ptr + 30, true);
        const commentLen = view.getUint16(ptr + 32, true);
        const localHeaderOffset = view.getUint32(ptr + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
        entries.push({ name, method, compressedSize, localHeaderOffset });
        ptr += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

/** Raw bytes of one entry's payload, decompressed if needed. */
async function readEntry(view: DataView, bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
    // The local header's own name/extra lengths (not the central directory's,
    // which can differ) determine where the payload starts.
    const o = entry.localHeaderOffset;
    const nameLen = view.getUint16(o + 26, true);
    const extraLen = view.getUint16(o + 28, true);
    const start = o + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return raw; // stored, uncompressed
    if (entry.method === 8) return inflateRaw(raw);
    throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
}

const decodeEntities = (s: string): string =>
    s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

/** Strip XML tags to leave the text nodes, which is where cell values live. */
const xmlText = (xml: string): string => decodeEntities(xml.replace(/<[^>]*>/g, ' '));

async function readOfficeArchive(view: DataView, bytes: Uint8Array): Promise<string> {
    const entries = readCentralDirectory(view, bytes);
    // xlsx keeps strings in xl/sharedStrings.xml and inline ones in the
    // worksheets; ods keeps everything in content.xml. Reading every .xml part
    // is simplest and, since only email-shaped tokens survive downstream,
    // grabbing extra markup text is harmless.
    const wanted = entries.filter((e) => e.name.toLowerCase().endsWith('.xml'));
    const chunks = await Promise.all(
        wanted.map(async (e) => {
            try {
                return xmlText(new TextDecoder().decode(await readEntry(view, bytes, e)));
            } catch {
                return ''; // one unreadable part shouldn't sink the whole import
            }
        }),
    );
    return chunks.join(' ');
}

/**
 * Returns all text found in the file as one string. A ZIP-based office
 * document is unpacked; anything else is treated as delimited text (CSV/TSV/
 * plain), which needs no parsing beyond decoding the bytes.
 */
export async function readFileText(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (looksLikeZip(bytes)) {
        return readOfficeArchive(new DataView(bytes.buffer), bytes);
    }
    return new TextDecoder().decode(bytes);
}
