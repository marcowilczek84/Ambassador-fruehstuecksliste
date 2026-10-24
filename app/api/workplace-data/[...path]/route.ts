import {personalAccess,unavailable} from '../../../../server/module-runtime.mjs';
import {relayData} from '../../../../server/data-relay.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request){try{const client=personalAccess();return client?await relayData({client,request,module:'breakfast',publishableKey:process.env.MODULE_SSO_SUPABASE_PUBLISHABLE_KEY}):unavailable();}catch{return Response.json({error:'authority_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export {handle as GET,handle as HEAD,handle as POST,handle as PATCH,handle as DELETE};
