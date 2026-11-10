import Link from "next/link";
import type { Route } from "next";
import "./crumbs.css";

export function Crumbs({ label, items }: { label: string; items: { name: string; href: string }[] }) {
  return (
    <nav className="seo-crumbs-nav" aria-label={label}>
      <ol className="seo-crumbs">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={item.href}>
              <Link href={item.href as Route} aria-current={current ? "page" : undefined}>
                {item.name}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
