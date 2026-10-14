// Build the local PostgreSQL sandbox separately from the production runtime.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const dir='public/qa-db-assets';fs.mkdirSync(dir,{recursive:true});
const dist=path.dirname(require.resolve('@electric-sql/pglite'));
for(const name of ['pglite.wasm','pglite.data'])fs.copyFileSync(path.join(dist,name),path.join(dir,name));
esbuild.buildSync({entryPoints:['qa/browser-database.mjs'],outfile:dir+'/database.js',bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.sql':'text'},minify:true,logLevel:'warning'});
