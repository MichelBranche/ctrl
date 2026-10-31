import type { ReactNode } from "react";

/** The site's one hero call-to-action: label, then a single arrow in a circle on the right. */
export function CtaLink({
  href,
  className = "",
  children,
  external = false,
  ...rest
}: { href: string; className?: string; children: ReactNode; external?: boolean } & Record<`data-${string}`, string | boolean>) {
  const ext = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a href={href} className={`cta ${className}`.trim()} {...ext} {...rest}>
      <span className="cta-label">{children}</span>
      <span className="cta-circle" data-magnetic aria-hidden="true">
        <svg className="cta-arrow" viewBox="0 0 24 24">
          <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
    </a>
  );
}
