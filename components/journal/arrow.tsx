export function JArrow({ className = "j-arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
