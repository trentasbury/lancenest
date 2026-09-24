export default function StarRule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-14 bg-brass" />
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-brass">
        <path d="M12 2l2.9 6.9L22 9.3l-5.5 4.8L18.2 22 12 17.8 5.8 22l1.7-7.9L2 9.3l7.1-.4z" />
      </svg>
      <span className="h-px w-14 bg-brass" />
    </div>
  );
}
