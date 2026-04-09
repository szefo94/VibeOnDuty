import { CELL } from './config.js';
import { MAP, MAP_W, MAP_H } from './map.js';

export function astar(sx,sz,ex,ez){
  const gc=v=>Math.floor(v/CELL);const[scx,scz,ecx,ecz]=[gc(sx),gc(sz),gc(ex),gc(ez)];
  if(scx===ecx&&scz===ecz)return[];
  const K=(x,z)=>x*100+z,h=(x,z)=>Math.abs(x-ecx)+Math.abs(z-ecz);
  const open=new Map(),closed=new Set();
  open.set(K(scx,scz),{x:scx,z:scz,g:0,f:h(scx,scz),parent:null});let it=0;
  while(open.size&&it++<600){
    let best=null;for(const n of open.values())if(!best||n.f<best.f)best=n;
    if(best.x===ecx&&best.z===ecz){const path=[];let c=best;while(c){path.unshift([c.x*CELL+CELL/2,c.z*CELL+CELL/2]);c=c.parent;}return path;}
    open.delete(K(best.x,best.z));closed.add(K(best.x,best.z));
    for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=best.x+dx,nz=best.z+dz;if(nx<0||nz<0||nx>=MAP_W||nz>=MAP_H)continue;
      const mc=MAP[nz][nx];if(mc===1)continue;if(closed.has(K(nx,nz)))continue;
      const g=best.g+1,ex2=open.get(K(nx,nz));if(!ex2||g<ex2.g)open.set(K(nx,nz),{x:nx,z:nz,g,f:g+h(nx,nz),parent:best});
    }
  }
  return[];
}
