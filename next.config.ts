import type { NextConfig } from "next";

const isolatedPreview = process.env.VERCEL_ENV === "preview";
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return {
      beforeFiles: [
        ...(isolatedPreview ? [{source: "/index-live.html", destination: "/qa-v4.html"}] : []),
        {
          source: "/_next/static/:path*",
          destination: "/recovered/_next/static/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return isolatedPreview ? [{source: "/:path*", headers: [
      {key: "Content-Security-Policy", value: "connect-src 'self'; frame-src 'self'; form-action 'self'"},
      {key: "X-Ambassador-Data-Mode", value: "isolated-postgres-qa"},
      {key: "X-Robots-Tag", value: "noindex, nofollow"},
    ]}] : [];
  },
};

export default nextConfig;
