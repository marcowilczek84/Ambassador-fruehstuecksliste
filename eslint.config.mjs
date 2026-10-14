import js from '@eslint/js';
// Lint the readable V4 source and its verification tooling. Recovered/minified
// historical bundles are preserved byte-for-byte, not reformatted or relinted.
const files=['public/service-first.js','public/workflow-polish.js','public/qa-v4{,-bootstrap}.js','scripts/prepare-{v4,qa}.cjs','qa/**/*.mjs','tests/**/*.cjs','eslint.config.mjs','playwright.config.cjs'];
const globals=Object.fromEntries(['window','document','localStorage','sessionStorage','location','parent','navigator','innerWidth','innerHeight','fetch','URL','URLSearchParams','Blob','Response','XMLHttpRequest','AbortSignal','crypto','CustomEvent','Event','setTimeout','clearTimeout','structuredClone','console','global','globalThis','WebAssembly','MutationObserver','NodeFilter','requestAnimationFrame','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Element','FileReader','getComputedStyle'].map(k=>[k,'readonly']));
export default [{ignores:['node_modules/**','.next/**','public/recovered/**','public/qa-db-assets/**','test-results/**','qa-evidence/**']},
 {files,languageOptions:{ecmaVersion:2023,globals},rules:{...js.configs.recommended.rules,'no-unused-vars':['error',{args:'none',caughtErrors:'none'}]}},
 {files:['**/*.cjs'],languageOptions:{sourceType:'commonjs',globals:{require:'readonly',module:'readonly',__dirname:'readonly',process:'readonly',Buffer:'readonly'}}},
 {files:['tests/precision-service.test.cjs'],rules:{'no-useless-escape':'off'}},
 {files:['public/service-first.js'],languageOptions:{sourceType:'script',globals:{module:'readonly'}}}
];
