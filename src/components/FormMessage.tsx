export default function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-[3px] border border-signal/30 bg-signal/5 px-3.5 py-2.5 text-sm text-signal">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-[3px] border border-olive/30 bg-olive/5 px-3.5 py-2.5 text-sm text-olive">
        {message}
      </p>
    );
  }
  return null;
}
