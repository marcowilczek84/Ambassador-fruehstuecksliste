const PRODUCTION_URL = "https://xgbbwnmqgpwxxftnjrkc.supabase.co";

export const dynamic = "force-dynamic";

export function GET() {
  const url = process.env.AMBASSADOR_GM_PRODUCTION_URL;
  const publishableKey = process.env.AMBASSADOR_GM_PRODUCTION_PUBLISHABLE_KEY;
  const valid = url === PRODUCTION_URL && publishableKey?.startsWith("sb_publishable_");
  const config = valid ? { url, publishableKey } : null;

  return new Response(`window.__AMBASSADOR_GM_CONFIG__ = ${JSON.stringify(config)};`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
