'use client';

export default function PrintButton({ label = 'Download PDF' }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="btn btn-primary">{label}</button>;
}
