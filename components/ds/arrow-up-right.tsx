/** Up-right arrow used by CTAs and links on the new pages. Size and hover motion come from the caller's class
 * (.hv-arrow on the home, .qx-arrow on CTRL® Quotes). */
export function ArrowUpRight({ className, strokeWidth = 1.5 }: { className: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}
