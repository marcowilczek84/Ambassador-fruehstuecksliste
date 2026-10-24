export function personalAccess(env?:NodeJS.ProcessEnv):null|{handle(request:Request):Promise<Response>;identity(request:Request,options?:{permission?:string;write?:boolean}):Promise<any>;databaseToken(request:Request):Promise<string|null>};
export function unavailable():Response;
