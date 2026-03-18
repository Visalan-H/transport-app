import type { BusDetails, BusText } from '../types';

const INTERVAL = 5000;
const TARGET_URL = Bun.env.TARGET_URL || 'http://localhost:4000/update';
const GPS_API_KEY = Bun.env.GPS_API_KEY;

if (!GPS_API_KEY) throw new Error('GPS_API_KEY is not set');

let failedRequests = 0;

const BUS_ORIGINS: Record<number, [number, number]> = {
    // North Chennai
    1: [13.0827, 80.2707], // MMC / Egmore
    14: [13.1127, 80.2540], // Moolakadai
    24: [13.2766, 80.3234], // Minjur
    25: [13.2195, 80.2913], // Mathur
    28: [13.1185, 80.2978], // Tondairpet
    31: [13.0950, 80.2878], // Mint
    38: [13.2133, 80.3284], // Ennore
    41: [13.1194, 80.2573], // Retteri
    42: [13.1194, 80.2573], // Welding Shop
    43: [13.2766, 80.3234], // Arul Nagar
    47: [13.1194, 80.2573], // Kolathur
    55: [13.1035, 80.2528], // Perambur
    58: [13.0786, 80.2752], // Chintadripet
    61: [13.1917, 80.1762], // Puzhal
    82: [13.0786, 80.2894], // Foreshore Estate
    83: [13.1185, 80.2978], // Royapuram

    // Central Chennai
    6: [13.0694, 80.2342], // TVK Nagar
    7: [13.0524, 80.2823], // Light House
    8: [13.0892, 80.2526], // Purasaivakkam
    9: [13.0892, 80.2526], // Chintamani
    10: [13.0892, 80.2526], // Choolai
    26: [13.0827, 80.2707], // Maharani
    29: [13.0680, 80.2785], // Nungambakkam
    40: [13.0418, 80.2341], // T Nagar
    63: [13.0418, 80.2341], // T Nagar II
    77: [13.0503, 80.2290], // Valluvarkottam
    89: [13.0694, 80.2108], // Choolaimedu

    // Anna Nagar / Northwest
    2: [13.0878, 80.2108], // Anna Nagar
    3: [13.0920, 80.2050], // Anna Nagar II
    4: [13.0860, 80.1980], // Anna Nagar III
    18: [13.1127, 80.2540], // MKB Nagar
    19: [13.0950, 80.2400], // Villivakkam
    33: [13.0732, 80.2144], // Aminjikarai
    34: [13.0694, 80.1986], // CMBT
    48: [13.1127, 80.2540], // MR Nagar
    62: [13.0878, 80.2108], // Anna Nagar I
    78: [13.0503, 80.2097], // Vadapalani
    96: [13.1000, 80.2200], // Thachur

    // West Chennai / Poonamallee belt
    5: [13.0469, 80.1021], // Poonamallee
    27: [13.0693, 80.1953], // Toll Gate
    30: [13.0693, 80.1953], // IOC
    35: [13.0694, 80.1666], // Maduravoyal
    37: [13.0358, 80.1573], // Porur
    39: [13.0382, 80.1952], // KK Nagar
    45: [12.9731, 80.0697], // Kundrathur
    67: [13.0469, 80.0694], // Pattabiram
    68: [13.0382, 80.1952], // Nesapakkam
    71: [12.9731, 80.1097], // Pammal

    // Ambattur / Avadi belt
    17: [13.1147, 80.1009], // Avadi
    51: [13.1916, 80.1762], // Redhills
    52: [13.1850, 80.1700], // Redhills II
    53: [13.1271, 80.1534], // Ayapakkam
    54: [13.1100, 80.1300], // Thiruverkadu
    79: [13.1148, 80.1648], // Ambattur
    81: [13.1148, 80.1648], // Thirumullaivoyal
    87: [13.1148, 80.1648], // Korattur
    98: [13.1147, 80.1009], // Avadi Murugappa
    99: [13.1200, 80.0950], // Avadi

    // South Chennai
    11: [12.9781, 80.2211], // Velachery
    12: [12.9650, 80.2150], // Velachery II
    13: [12.9900, 80.2050], // Adambakkam
    36: [13.0067, 80.2206], // Guindy
    44: [12.9731, 80.1488], // Pallavaram
    46: [12.9082, 80.1454], // SRMC
    56: [12.8698, 80.0595], // Guduvanchery
    57: [12.9249, 80.0825], // Vandalur Zoo
    59: [12.9091, 80.2583], // VGP
    65: [12.9249, 80.1138], // Tambaram
    66: [12.9100, 80.1250], // Selaiyur
    69: [12.9350, 80.1400], // Hasthinapuram
    70: [12.9400, 80.1350], // Chrompet
    72: [12.9300, 80.1831], // Medavakkam
    73: [12.9100, 80.1900], // Kilkattalai
    74: [12.9000, 80.2000], // Pallikaranai
    75: [12.8850, 80.1950], // Madambakkam
    90: [12.7826, 80.2209], // Kelambakkam
    93: [12.6921, 80.0000], // Chengalpet

    // Thiruvallur / Northwest far
    15: [13.1167, 80.0007], // Thiruninravur
    16: [13.1100, 79.9500], // Thiruninravur II
    22: [13.0985, 79.9942], // GRT Manavala Nagar
    23: [13.0900, 79.9800], // GRT II
    76: [13.1432, 79.9083], // Thiruvallur
    80: [13.1432, 79.7714], // Kadambathur
    101: [13.1853, 79.8983], // Nemili
    102: [13.1432, 79.9083], // Aranvoyal

    // Kanchipuram belt
    20: [13.0837, 79.6716], // Arakkonam
    21: [12.8352, 79.7036], // Kanchipuram I
    32: [12.9249, 80.0825], // Vandalur
    49: [13.0600, 79.7200], // Arakkonam II
    50: [12.8500, 79.7200], // Kanchipuram II
    60: [12.8464, 79.9687], // Oragadam
    64: [13.0837, 79.5714], // Thakkolam
    84: [12.8200, 79.6800], // Kanchipuram III
    85: [12.8100, 79.6900], // Kanchipuram IV
    86: [12.8000, 79.7100], // Kanchipuram V
    88: [13.0700, 79.6500], // Arakkonam III
    91: [13.4231, 79.6153], // Thiruttani
    92: [13.3528, 79.5014], // Sholingur
    94: [12.9054, 79.3167], // Arcot
    95: [12.9100, 79.3300], // Walaja
    97: [12.7900, 79.7200], // Kanchipuram VI
    100: [13.0900, 79.6800], // Arakkonam IV
};

const BUS_COUNT = Object.keys(BUS_ORIGINS).length;

const buses: BusDetails[] = Object.entries(BUS_ORIGINS).map(([id, [lat, lng]]) => ({
    id: Number(id),
    lat: lat + (Math.random() - 0.5) * 0.01,
    lng: lng + (Math.random() - 0.5) * 0.01,
    timestamp: Date.now(),
}));

const moveBus = (bus: BusDetails) => {
    bus.lat += (Math.random() - 0.5) * 0.004;
    bus.lng += (Math.random() - 0.5) * 0.004;
    bus.timestamp = Date.now();
};

const simulateMovement = () => {
    buses.forEach(moveBus);
    console.log(`[SIM] sending ${BUS_COUNT} updates to ${TARGET_URL}`);

    buses.forEach((bus) => {
        const payload: BusText = `${bus.id},${bus.lat},${bus.lng},${bus.timestamp}`;
        fetch(TARGET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', 'x-api-key': GPS_API_KEY! },
            body: payload,
        }).catch((error) => {
            failedRequests++;
            if (failedRequests % 50 === 1) {
                console.error(`[SIM] failed (failures: ${failedRequests})`, error);
            }
        });
    });
};

console.log(`Simulating ${BUS_COUNT} buses across Chennai`);
setInterval(simulateMovement, INTERVAL);