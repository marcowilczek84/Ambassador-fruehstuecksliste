// Follow the deployment associated with this exact commit, never Production.
const fs = require('node:fs');
const api = 'https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY;
async function get(path) {
  const response = await fetch(api+path, {headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'}});
  if(!response.ok) throw Error('GitHub deployment lookup: '+response.status);
  return response.json();
}
(async()=>{
  for(let attempt=0;attempt<70;attempt++) {
    const deployments=await get('/deployments?sha='+process.env.GITHUB_SHA+'&per_page=30');
    for(const deployment of deployments) {
      if(deployment.production_environment || /production/i.test(deployment.environment)) continue;
      const statuses=await get('/deployments/'+deployment.id+'/statuses');
      const status=statuses.find(s=>s.state==='success'&&s.environment_url);
      if(!status) continue;
      const preview=new URL('/index-live.html',status.environment_url);
      // Several Vercel projects share this repository. Accept only this app's
      // immutable Preview hostname, never another project's successful status.
      if(!/^ambassador-fruehstuecksliste-[a-z0-9]+-restaurant-silk\.vercel\.app$/.test(preview.hostname)) continue;
      const target=preview.href;
      const response=await fetch(target);
      if(!response.ok || !(await response.text()).includes('workflow-polish.js')) continue;
      fs.appendFileSync(process.env.GITHUB_ENV,'PREVIEW_URL='+target+'\nSOURCE_SHA='+process.env.GITHUB_SHA+'\n');
      fs.mkdirSync('responsive-audit-output',{recursive:true});
      fs.writeFileSync('responsive-audit-output/deployment.json',JSON.stringify({commit:process.env.GITHUB_SHA,githubDeploymentId:deployment.id,environment:deployment.environment,previewUrl:target,statusUrl:status.url},null,2));
      console.log('Verified commit preview: '+target);return;
    }
    console.log('Waiting for this commit’s preview ('+(attempt+1)+'/70)');
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  throw Error('No successful Preview deployment found for '+process.env.GITHUB_SHA);
})();
