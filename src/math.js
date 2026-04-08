export function normA(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
export function slerp(cur,tgt,spd,dt){const d=normA(tgt-cur),st=spd*dt;if(Math.abs(d)<st)return tgt;return cur+Math.sign(d)*st;}
