import {readFileSync, existsSync} from 'node:fs';
import {resolve, basename} from 'node:path';

const html=readFileSync('dist/index.html','utf8');
const assets=[...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"?#]+)"/g)].map(m=>m[1]);
if(!assets.length)throw Error('Built website has no JavaScript/style assets.');
for(const asset of assets){
  if(!existsSync(resolve('dist/assets',basename(asset))))throw Error(`Missing website asset: ${asset}`);
}
console.log(`Website asset check passed (${assets.length} assets).`);
