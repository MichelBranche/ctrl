export function PArrow({ className = "p-arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg className="p-view-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3h5.5v5.5H3zM11.5 3H17v5.5h-5.5zM3 11.5h5.5V17H3zM11.5 11.5H17V17h-5.5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg className="p-view-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
