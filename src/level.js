import * as THREE from 'three';
import { CELL, WALL_H, PLAYER_H } from './config.js';
import { MAP_W, MAP_H, MAP, HMAP, H2, isRamp, isCrack, mapCell } from './map.js';
import { mm, matFloor, matWall, matWallD, matWallT, matCrack, matTrim, matRamp } from './materials.js';
import { scene } from './scene.js';

export const wallMeshes=[];
const debugLineData=[];
export let debugLines=null;

(function buildLevel(){
  // Ground
  const fl=new THREE.Mesh(new THREE.PlaneGeometry((MAP_W+4)*CELL,(MAP_H+4)*CELL),matFloor);
  fl.rotation.x=-Math.PI/2;fl.position.set(MAP_W*CELL/2,0,MAP_H*CELL/2);fl.receiveShadow=true;scene.add(fl);

  for(let row=0;row<MAP_H;row++){
    for(let col=0;col<MAP_W;col++){
      const cell=MAP[row][col];if(cell===0)continue;
      const wx=col*CELL+CELL/2, wz=row*CELL+CELL/2;
      if(cell===1){
        const n=mapCell(col,row-1),s=mapCell(col,row+1),e2=mapCell(col+1,row),w2=mapCell(col-1,row);
        const isPillar=(n===0&&s===0&&e2===0&&w2===0);
        if(isPillar){
          const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.62,WALL_H+0.8,12),matWall);
          shaft.position.set(wx,(WALL_H+0.8)/2,wz);shaft.castShadow=shaft.receiveShadow=true;scene.add(shaft);wallMeshes.push(shaft);
          const cap=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.35,1.4),matWallT);cap.position.set(wx,WALL_H+0.8,wz);scene.add(cap);
          const base=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.22,1.5),matWallT);base.position.set(wx,0.11,wz);scene.add(base);
          debugLineData.push({x:wx-0.7,y:0,z:wz-0.7,w:1.4,h:WALL_H+0.8,d:1.4,col:0xff8800});
        } else {
          const w=new THREE.Mesh(new THREE.BoxGeometry(CELL,WALL_H,CELL),[matWallD,matWallD,matWallT,matFloor,matWall,matWall]);
          w.position.set(wx,WALL_H/2,wz);w.castShadow=w.receiveShadow=true;scene.add(w);wallMeshes.push(w);
          const t=new THREE.Mesh(new THREE.BoxGeometry(CELL,0.18,CELL),matTrim);t.position.set(wx,0.09,wz);scene.add(t);
          debugLineData.push({x:wx-CELL/2,y:0,z:wz-CELL/2,w:CELL,h:WALL_H,d:CELL,col:0xff3300});
        }
      } else if(isCrack(cell)){
        const loH=PLAYER_H-0.28, upH=0.55;
        const gw=cell===2?CELL:0.35, gd=cell===2?0.35:CELL;
        const lo=new THREE.Mesh(new THREE.BoxGeometry(gw,loH,gd),matCrack);
        lo.position.set(wx,loH/2,wz);lo.castShadow=lo.receiveShadow=true;scene.add(lo);wallMeshes.push(lo);
        const up=new THREE.Mesh(new THREE.BoxGeometry(gw,upH,gd),matCrack);
        up.position.set(wx,PLAYER_H+0.28+upH/2,wz);up.castShadow=true;scene.add(up);wallMeshes.push(up);
        debugLineData.push({x:wx-gw/2,y:0,z:wz-gd/2,w:gw,h:loH,d:gd,col:0x0088ff});
        debugLineData.push({x:wx-gw/2,y:PLAYER_H+0.28,z:wz-gd/2,w:gw,h:upH,d:gd,col:0x0088ff});
      } else if(isRamp(cell)){
        const gh=H2, H=CELL/2;
        let A,B,C,D,E,F;
        if(cell===4){A=[-H,0,-H];B=[H,0,-H];C=[H,gh,H];D=[-H,gh,H];E=[-H,0,H];F=[H,0,H];}
        else if(cell===5){A=[-H,0,H];B=[H,0,H];C=[H,gh,-H];D=[-H,gh,-H];E=[-H,0,-H];F=[H,0,-H];}
        else if(cell===6){A=[-H,0,-H];B=[-H,0,H];C=[H,gh,H];D=[H,gh,-H];E=[H,0,-H];F=[H,0,H];}
        else{A=[H,0,H];B=[H,0,-H];C=[-H,gh,-H];D=[-H,gh,H];E=[-H,0,H];F=[-H,0,-H];}
        const verts=[
          ...D,...C,...B, ...D,...B,...A,
          ...A,...B,...F, ...A,...F,...E,
          ...A,...E,...D,
          ...B,...C,...F,
          ...D,...E,...F, ...D,...F,...C,
        ];
        const rampGeo=new THREE.BufferGeometry();
        rampGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(verts),3));
        rampGeo.computeVertexNormals();
        const rampMat=new THREE.MeshStandardMaterial({color:matRamp.color,roughness:matRamp.roughness,metalness:matRamp.metalness,side:THREE.DoubleSide});
        const rm=new THREE.Mesh(rampGeo,rampMat);
        rm.position.set(wx,0,wz);rm.castShadow=rm.receiveShadow=true;scene.add(rm);
        debugLineData.push({x:wx-CELL/2,y:0,z:wz-CELL/2,w:CELL,h:gh,d:CELL,col:0xffee00});
      }
    }
  }

  // Rubble
  const rubbleMat=mm(0x8a7a60,0.97,0.0);
  for(let i=0;i<80;i++){
    const rc=1+Math.floor(Math.random()*(MAP_W-2)),rr=1+Math.floor(Math.random()*(MAP_H-2));
    if(MAP[rr][rc]!==0)continue;
    const sz=0.15+Math.random()*0.35;
    const rb=new THREE.Mesh(new THREE.BoxGeometry(sz,sz*0.5,sz*0.85),rubbleMat);
    rb.position.set(rc*CELL+Math.random()*CELL*0.8,sz*0.25,rr*CELL+Math.random()*CELL*0.8);
    rb.rotation.y=Math.random()*Math.PI;rb.rotation.z=(Math.random()-0.5)*0.3;
    rb.receiveShadow=rb.castShadow=true;scene.add(rb);
  }

  // Elevated terrain slabs
  const elevMat=mm(0xb8a070,0.94,0.01),elevSide=mm(0x8a7050,0.96,0.01);
  const built=new Set();
  for(let r=0;r<MAP_H;r++){
    for(let c=0;c<MAP_W;c++){
      const h=HMAP[r][c];if(!h||MAP[r][c]!==0)continue;
      const key=`${c},${r}`;if(built.has(key))continue;
      let w=1;while(c+w<MAP_W&&HMAP[r][c+w]===h&&MAP[r][c+w]===0&&!built.has(`${c+w},${r}`))w++;
      let d=1;
      outer:while(r+d<MAP_H){for(let cc=c;cc<c+w;cc++){if(HMAP[r+d][cc]!==h||MAP[r+d][cc]!==0||built.has(`${cc},${r+d}`)){break outer;}}d++;}
      for(let dr=0;dr<d;dr++)for(let dc=0;dc<w;dc++)built.add(`${c+dc},${r+dr}`);
      const pw=w*CELL,pd=d*CELL,cx2=(c+w/2)*CELL,cz2=(r+d/2)*CELL;
      const slab=new THREE.Mesh(new THREE.BoxGeometry(pw,h,pd),[elevSide,elevSide,elevMat,elevMat,elevSide,elevSide]);
      slab.position.set(cx2,h/2,cz2);slab.receiveShadow=slab.castShadow=true;scene.add(slab);
      debugLineData.push({x:cx2-pw/2,y:0,z:cz2-pd/2,w:pw,h,d:pd,col:0x00ff88});
    }
  }

  buildDebugLines();
})();

function buildDebugLines(){
  const groups={};
  for(const d of debugLineData){
    const k=d.col.toString(16);
    if(!groups[k]){groups[k]={pts:[],col:d.col};}
    const{x,y,z,w,h,d:depth}=d;
    const corners=[[x,y,z],[x+w,y,z],[x+w,y,z+depth],[x,y,z+depth],[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+depth],[x,y+h,z+depth]];
    [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>groups[k].pts.push(...corners[a],...corners[b]));
  }
  const grp=new THREE.Group();
  for(const{pts,col} of Object.values(groups)){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    grp.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.8})));
  }
  debugLines=grp;debugLines.visible=false;scene.add(debugLines);
}
