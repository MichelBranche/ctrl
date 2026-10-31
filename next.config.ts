import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Admin cover uploads go through a Server Action (covers are capped at 5 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/covers/**" }],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3440, 3840],
    qualities: [75, 90],
  },
  // The old /work pages were replaced by /projects (website concepts map to the websites category).
  async redirects() {
    return [
      { source: "/work", destination: "/projects", permanent: true },
      { source: "/work/:slug", destination: "/projects/websites", permanent: true },
      { source: "/en/work", destination: "/en/projects", permanent: true },
      { source: "/en/work/:slug", destination: "/en/projects/websites", permanent: true },
      // The Studio page was removed; the home has no about section, so send it home.
      { source: "/about", destination: "/", permanent: true },
      { source: "/en/about", destination: "/en", permanent: true },
    ];
  },
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
