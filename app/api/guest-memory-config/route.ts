const PRODUCTION_URL = "https://xgbbwnmqgpwxxftnjrkc.supabase.co";

export const dynamic = "force-dynamic";

export function GET() {
  const url = process.env.AMBASSADOR_GM_PRODUCTION_URL;
  const publishableKey = process.env.AMBASSADOR_GM_PRODUCTION_PUBLISHABLE_KEY;
  const serviceLogin = process.env.AMBASSADOR_GM_SERVICE_LOGIN;
  const receptionLogin = process.env.AMBASSADOR_GM_RECEPTION_LOGIN;
  const valid = url === PRODUCTION_URL && publishableKey?.startsWith("sb_publishable_")
    && serviceLogin && receptionLogin;
  const config = valid ? { url, publishableKey, accounts: { SERVICE: serviceLogin, RECEPTION: receptionLogin } } : null;

  return new Response(`window.__AMBASSADOR_GM_CONFIG__ = ${JSON.stringify(config)};`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
