import {personalAccess,unavailable} from '../../../server/module-runtime.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request){try{const client=personalAccess();return client?await client.handle(request):unavailable();}catch{return Response.json({error:'authority_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export {handle as GET,handle as POST};
