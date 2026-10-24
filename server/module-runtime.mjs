import {createModuleClient} from './module-client.mjs';
let cached;
export function personalAccess(env=process.env){
 if(env.MODULE_SSO_ENABLED!=='true')return null;
 if(!cached)cached=createModuleClient({module:'breakfast',clientId:'ambassador-breakfast',clientSecret:env.MODULE_SSO_CLIENT_SECRET,issuer:env.MODULE_SSO_ISSUER,origin:env.MODULE_SSO_ORIGIN});
 return cached;
}
export function unavailable(){return new Response(JSON.stringify({error:'not_found'}),{status:404,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});}
