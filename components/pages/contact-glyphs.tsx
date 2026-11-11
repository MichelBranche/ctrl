type GlyphName =
  | "website" | "hotel" | "shop" | "app" | "brand" | "other"
  | "leads" | "bookings" | "rebuild" | "scratch"
  | "asap" | "quarter" | "exploring"
  | "under" | "mid" | "high" | "top" | "unsure"
  | "check" | "copy";

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Glyph({ name }: { name: GlyphName }) {
  return (
    <svg className="cw-ico" viewBox="0 0 24 24" aria-hidden="true">
      {mark(name)}
    </svg>
  );
}

function mark(name: GlyphName) {
  switch (name) {
    case "website":
      return (
        <>
          <rect {...common} x="3" y="5" width="18" height="14" rx="1.5" />
          <path {...common} d="M3 9h18" />
        </>
      );
    case "hotel":
      return (
        <>
          <path {...common} d="M4 20V9.5L12 5l8 4.5V20" />
          <path {...common} d="M9 20v-5h6v5M9 11h.01M12 11h.01M15 11h.01" />
        </>
      );
    case "shop":
      return (
        <>
          <path {...common} d="M6 8h12l-1.2 11H7.2L6 8z" />
          <path {...common} d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </>
      );
    case "app":
      return (
        <>
          <rect {...common} x="3.5" y="3.5" width="7" height="7" rx="1.4" />
          <rect {...common} x="13.5" y="3.5" width="7" height="7" rx="1.4" />
          <rect {...common} x="3.5" y="13.5" width="7" height="7" rx="1.4" />
          <rect {...common} x="13.5" y="13.5" width="7" height="7" rx="1.4" />
        </>
      );
    case "brand":
      return <path {...common} d="M12 3.5 19 12l-7 8.5L5 12l7-8.5z" />;
    case "other":
      return <path {...common} d="M12 5v14M5 12h14" />;
    case "leads":
      return (
        <>
          <circle {...common} cx="9" cy="9" r="2.2" />
          <circle {...common} cx="16" cy="10" r="1.8" />
          <path {...common} d="M4.8 18.5c.6-2.4 2.4-3.6 4.2-3.6s3.6 1.2 4.2 3.6M14 14.9c1.3-.5 2.6-.4 3.6.4 1 .8 1.5 2 1.6 3.2" />
        </>
      );
    case "bookings":
      return (
        <>
          <rect {...common} x="4" y="5.5" width="16" height="14" rx="1.5" />
          <path {...common} d="M8 4v3M16 4v3M4 10h16" />
        </>
      );
    case "rebuild":
      return <path {...common} d="M20 12a8 8 0 1 1-2.2-5.5M20 4.5V9h-4.5" />;
    case "scratch":
      return <path {...common} d="M12 3.5 13.6 9H19l-4.4 3.3 1.7 5.2L12 14.2 7.7 17.5 9.4 12.3 5 9h5.4L12 3.5z" />;
    case "asap":
      return <path {...common} d="M13 3 6 13h5l-1 8 8-11h-5l0-7z" />;
    case "quarter":
      return (
        <>
          <circle {...common} cx="12" cy="12" r="7.5" />
          <path {...common} d="M12 8v4.5l3 2" />
        </>
      );
    case "exploring":
      return (
        <>
          <circle {...common} cx="12" cy="12" r="7.5" />
          <circle {...common} cx="12" cy="12" r="1.3" />
          <path {...common} d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2" />
        </>
      );
    case "under":
      return <path {...common} d="M5 16h14M8 12h8" />;
    case "mid":
      return <path {...common} d="M5 17h14M6 13h12M8 9h8" />;
    case "high":
      return <path {...common} d="M5 18h14M6 14h12M7 10h10M9 6h6" />;
    case "top":
      return (
        <>
          <path {...common} d="M5 19h14M6 15h12M7 11h10M9 7h6" />
          <path {...common} d="M12 3.5v2" />
        </>
      );
    case "unsure":
      return (
        <>
          <circle {...common} cx="12" cy="12" r="7.5" />
          <path {...common} d="M9.2 9.5a2.8 2.8 0 1 1 3.6 2.6c-.8.3-1.3.9-1.3 1.7V14.5" />
          <path {...common} d="M12 17h.01" />
        </>
      );
    case "check":
      return <path {...common} d="M5 12.5 9.2 16.5 19 7.5" />;
    case "copy":
      return (
        <>
          <rect {...common} x="8" y="8" width="11" height="12" rx="1.4" />
          <path {...common} d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-8A1.5 1.5 0 0 0 5 5.5v10A1.5 1.5 0 0 0 6.5 17H8" />
        </>
      );
    default: {
      const exhaustive: never = name;
      return exhaustive;
    }
  }
}

export type { GlyphName };
