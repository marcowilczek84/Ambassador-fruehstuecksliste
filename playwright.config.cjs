const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'tests/browser',workers:1,timeout:90000,expect:{timeout:15000},
 reporter:[['list'],['json',{outputFile:'qa-evidence/browser-results.json'}]],
 use:{browserName:process.env.QA_BROWSER||'chromium',baseURL:process.env.QA_BASE_URL||'http://127.0.0.1:3001',headless:true,
  launchOptions:process.env.QA_BROWSER==='webkit'?{}:{...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']},
  screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:process.env.QA_BASE_URL?undefined:{command:'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001',env:{VERCEL_ENV:'preview'},url:'http://127.0.0.1:3001',reuseExistingServer:false,timeout:30000},
});
