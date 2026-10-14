// Test adapter only: exact PostgreSQL functions, no production connection or credentials.
const signatures={
 breakfast_service_action_v4:['p_list_date','p_room','p_expected','p_delta','p_action_id'],
 breakfast_service_action_v41:['p_list_date','p_room','p_expected','p_delta','p_action_id','p_table','p_undo_action_id'],
 breakfast_room_edit_v42:['p_list_date','p_room','p_expected','p_changes','p_action_id'],
 breakfast_import_v41:['p_list_date','p_rooms'],
 merge_breakfast_changes:['p_list_date','p_rooms','p_arrivals','p_history','p_activity','p_updated']
};
export async function isolatedDatabase(db,fixture,schema,migration){
 const exists=(await db.query("SELECT to_regclass('public.breakfast_lists') AS name")).rows[0].name;
 if(!exists)await db.exec(schema);
 await db.exec(migration);
 await db.query('INSERT INTO public.breakfast_lists VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[fixture.date,fixture,fixture.updated]);
 const read=async()=> (await db.query('SELECT payload FROM public.breakfast_lists WHERE list_date=$1',[fixture.date])).rows[0].payload;
 const rpc=async(name,args)=>{
  const keys=signatures[name];if(!keys)throw Error('Unknown isolated RPC');
  const result=await db.query(`SELECT public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) AS result`,keys.map(k=>args[k]??null));
  return result.rows[0].result;
 };
 const request=async(path,method,args)=>{
  const url=new URL(path,'https://isolated.invalid');
  try{
   if(method==='GET'&&url.pathname==='/rest/v1/breakfast_lists'){
    const date=(url.searchParams.get('list_date')||'eq.'+fixture.date).replace(/^eq\./,'');
    const result=await db.query('SELECT payload,updated_at FROM public.breakfast_lists WHERE list_date=$1',[date]);
    return {status:200,body:result.rows};
   }
   if(method==='GET'&&url.pathname.includes('guest_preferences'))return{status:200,body:[]};
   if(method==='POST'&&url.pathname.startsWith('/rest/v1/rpc/'))return{status:200,body:await rpc(url.pathname.split('/').at(-1),args)};
   return{status:403,body:{message:'Isolated QA: request blocked'}};
  }catch(e){return{status:400,body:{code:e.code||'QA_ERROR',message:e.message}}}
 };
 return{db,read,rpc,request};
}
