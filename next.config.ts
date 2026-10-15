import type { NextConfig } from "next";
// This development branch is deliberately preview-only until release approval.
if (process.env.VERCEL_ENV === "production") {
  throw new Error("V4.1 requires a separate production release approval and configuration review.");
}
const nextConfig: NextConfig = {
  turbopack: {root: process.cwd()},
  async rewrites() {
    return {beforeFiles: [
      {source: "/index-live.html", destination: "/auth.html"},
      {source: "/_next/static/:path*", destination: "/recovered/_next/static/:path*"},
    ],afterFiles: [],fallback: []};
  },
  async headers() {
    return [{source: "/:path*",headers: [
      {key:"Content-Security-Policy",value:"connect-src 'self' https://jeuvmhahanaulvrnasgq.supabase.co; frame-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"},
      {key:"X-Ambassador-Data-Mode",value:"isolated-supabase-v41"},
      {key:"Referrer-Policy",value:"no-referrer"},
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"X-Robots-Tag",value:"noindex, nofollow"},
      {key:"Cache-Control",value:"no-store"},
    ]},{source:"/qa-v4.html",headers:[{key:"X-Ambassador-Data-Mode",value:"isolated-postgres-qa"}]}];
  },
};
export default nextConfig;
