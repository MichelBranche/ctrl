import type { NextConfig } from "next";

// Static CSP (no nonce): a per-request nonce would make every page dynamic and defeat Cache Components.
// Next streams inline bootstrap scripts, so script-src keeps 'unsafe-inline' but only same-origin script files load.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com",
  "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
  "frame-src 'self' https://www.youtube-nocookie.com https://www.google.com https://maps.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  // Admin cover uploads go through a Server Action (covers are capped at 5 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" }, globalNotFound: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/covers/**" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/shop/**" },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3440, 3840],
    qualities: [75, 90],
  },
  // Baseline hardening for every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
  // The old /work pages were replaced by /projects (website concepts map to the websites category).
  async rewrites() {
    return [{ source: "/:key([a-fA-F0-9]{8,128})\\.txt", destination: "/api/indexnow-key/:key" }];
  },
  async redirects() {
    return [
      { source: "/work", destination: "/projects", permanent: true },
      { source: "/work/:slug", destination: "/projects/websites", permanent: true },
      { source: "/en/work", destination: "/en/projects", permanent: true },
      // Webapp category lives on its service page; /projects/webapps/agenda-easy stays.
      { source: "/projects/webapps", destination: "/services/webapp", permanent: true },
      { source: "/en/projects/webapps", destination: "/en/services/webapp", permanent: true },
      // The "Mockup realistici" placeholder category was replaced by the managed security service.
      { source: "/projects/commercial-mockups", destination: "/services/web-security", permanent: true },
      { source: "/en/projects/commercial-mockups", destination: "/en/services/web-security", permanent: true },
      { source: "/projects/web-security", destination: "/services/web-security", permanent: true },
      { source: "/en/projects/web-security", destination: "/en/services/web-security", permanent: true },
      { source: "/en/work/:slug", destination: "/en/projects/websites", permanent: true },
      // The Studio page was removed; the home has no about section, so send it home.
      { source: "/about", destination: "/", permanent: true },
      { source: "/en/about", destination: "/en", permanent: true },
    ];
  },
  // Mail libraries use Node sockets/streams; keep them out of the bundle.
  serverExternalPackages: ["imapflow", "nodemailer", "mailparser"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
