import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// One versioned script prevents partial module loading and stale mixed releases.
const sources=await Promise.all(['domain.js','api.js','app.js'].map(name=>readFile(new URL(name,import.meta.url),'utf8')));
const source="'use strict';\n(()=>{\n"+sources.map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n})();\n';
const version=createHash('sha256').update(source).digest('hex').slice(0,12);
await writeFile(new URL('app.bundle.js',import.meta.url),source);
const index=new URL('index.html',import.meta.url);
let html=await readFile(index,'utf8');
html=html.replace(/<script[^>]*src="\.\/app(?:\.bundle)?\.js[^" ]*"[^>]*><\/script>/,'<script defer src="./app.bundle.js?v='+version+'"></script>');
await writeFile(index,html);
