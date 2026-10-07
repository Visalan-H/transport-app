/** The small inline message under a form field. Renders nothing without a message. */
export function FieldNote({ id, message }: { id: string; message: string | null }) {
    if (!message) return null;
    return (
        <p id={id} className="ml-1 text-xs text-destructive/80">
            {message}
        </p>
    );
}
