import { readFileSync, readdirSync } from 'node:fs';
const ROOT='D:/ai/HD2研究';
const dir=readdirSync(ROOT+'/工具/音频patch修复器').find(n=>n.startsWith('.selftest-'));
const a=new Uint8Array(readFileSync(ROOT+'/工具/音频patch修复器/'+dir+'/produced.patch_0'));
const bz=new Uint8Array(readFileSync(ROOT+'/待修复MOD/RS-422 railgun anime girl countdown FIXED-26088801-v3.zip'));
console.log('produced',a.length);
// read v3 patch from zip using fflate
import { unzipSync } from 'fflate';
const files=unzipSync(bz);
const key=Object.keys(files).find(k=>k.endsWith('.patch_0'));
const b=files[key];
console.log('v3      ',b.length,'name',key);
const dv=(x)=>new DataView(x.buffer,x.byteOffset,x.byteLength);
for (const [n,x] of [['produced',a],['v3',b]]) {
  const v=dv(x);
  const tc=v.getUint32(4,true), ec=v.getUint32(8,true);
  const base=72+tc*32;
  const offs=[];
  for(let i=0;i<ec;i++){const o=base+i*80;offs.push({off:Number(v.getBigUint64(o+16,true)),size:v.getUint32(o+56,true),idx:v.getUint32(o+76,true)});}
  console.log(n,'tc',tc,'ec',ec,'base',base,JSON.stringify(offs));
}
let first=-1; for(let i=0;i<Math.min(a.length,b.length);i++){ if(a[i]!==b[i]){first=i;break;} }
console.log('first diff at', first, 'of', Math.min(a.length,b.length));
if(first>=0){ console.log('a', Array.from(a.slice(first-8,first+24))); console.log('b', Array.from(b.slice(first-8,first+24))); }