// City scenery is built once and toggled as a whole when changing maps.
export function buildCity(THREE,{scene,mesh,box,cyl,ell,branch,label,mat,M,terrainY,obstacle}){
  const root=new THREE.Group();root.name='Miasto — Kozopolis';scene.add(root);
  function place(x,z){const g=new THREE.Group();g.position.set(x,terrainY(x,z),z);root.add(g);return g;}
  function surface(x,z,w,d,material,lift=.04){
    const geo=new THREE.PlaneGeometry(w,d,Math.ceil(w/2),Math.ceil(d/2));geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setY(i,terrainY(x+pos.getX(i),z+pos.getZ(i))+lift);
    geo.computeVertexNormals();const o=mesh(geo,material,root);o.position.set(x,0,z);o.castShadow=false;return o;
  }
  const pavement=mat(0xaaa79b),asphalt=mat(0x464c4e),windowMat=mat(0x4f747d,{metalness:.55,roughness:.23});
  surface(0,0,98,98,pavement);
  surface(0,0,11,98,asphalt,.055);surface(0,0,98,10,asphalt,.058);
  // The southern block is a grassy urban park containing the new gym.
  surface(-16,25,21,24,mat(0x8a9c65),.06);
  for(let z=-45;z<=45;z+=6)box(root,M.cream,0,terrainY(0,z)+.07,z,.15,.015,2.8);
  for(let x=-45;x<=45;x+=6)if(Math.abs(x)>8)box(root,M.cream,x,terrainY(x,0)+.072,0,2.8,.015,.15);
  for(const z of [-8,8])for(let i=0;i<7;i++)box(root,M.white,-4.3+i*1.4,terrainY(-4.3+i*1.4,z)+.08,z,.8,.02,2.6);
  for(const x of [-8,8])for(let i=0;i<6;i++)box(root,M.white,x,terrainY(x,-3.5+i*1.4)+.08,-3.5+i*1.4,2.6,.02,.8);
  function building(x,z,w,d,h,color,name){
    const g=place(x,z),wall=mat(color);
    box(g,wall,0,h/2,0,w,h,d);box(g,M.cream,0,.35,d/2+.07,w,.7,.14);
    box(g,M.cream,0,h+.1,0,w+.35,.25,d+.35);
    for(let y=2.3;y<h-.8;y+=2.5)for(let dx=-w/2+1.3;dx<w/2-.7;dx+=2.1){
      box(g,M.cream,dx,y,d/2+.1,1.28,1.6,.16);box(g,windowMat,dx,y,d/2+.2,1.08,1.38,.035);
      box(g,M.cream,dx,y,d/2+.23,.055,1.38,.04);
      box(g,windowMat,dx,y,-d/2-.1,1.08,1.38,.04);
    }
    for(let y=2.3;y<h-.8;y+=2.5)for(let dz=-d/2+1.3;dz<d/2-.7;dz+=2.1)
      for(const side of [-1,1])box(g,windowMat,side*(w/2+.1),y,dz,.04,1.4,1.1);
    box(g,M.darkWood,0,1.2,d/2+.12,1.45,2.4,.15);box(g,windowMat,0,1.45,d/2+.22,1.1,1.5,.04);
    if(name)label(name,0,d/2+.27,3.6,g,Math.min(w-1,7));
    obstacle(x,z,w/2+.2,d/2+.2);
  }
  building(-22,-23,15,15,14,0xb59a84,'KOZIA KAWIARNIA');
  building(-40,-23,12,17,19,0xa2aaa0);
  building(22,-29,16,12,17,0xd1c5a5,'BEE BANK');
  building(40,-26,12,20,23,0x909eaa);
  building(24,34,19,12,15,0xbc9479,'HOTEL POD ROGIEM');
  building(40,20,10,12,11,0xa2aaa0);
  building(-39,28,12,24,16,0xc5b999,'MARCHEW MARKET');
  building(-24,43,15,8,11,0xa0b2b1);
  for(const x of [-7,7])for(const z of [-40,-18,18,40]){
    const g=place(x,z);cyl(g,M.metal,0,2.6,0,.065,.1,5.2);
    branch(g,M.metal,[0,5.1,0],[x<0?1:-1,5.1,0],.06,.06);
    box(g,M.metal,x<0?.85:-.85,5.06,0,.7,.16,.3);box(g,mat(0xffefb4,{emissive:0xffd693,emissiveIntensity:.5}),x<0?.85:-.85,4.96,0,.6,.045,.25);
  }
  function car(x,z,color,turn=0){
    const g=place(x,z);g.rotation.y=turn;const body=mat(color,{metalness:.4,roughness:.35});
    box(g,body,0,.65,0,1.85,.65,3.8);box(g,body,0,1.15,-.15,1.6,.6,1.9);
    box(g,windowMat,0,1.26,-1.12,1.4,.43,.035);box(g,windowMat,0,1.26,.82,1.4,.43,.035);
    for(const side of [-1,1]){box(g,windowMat,side*.81,1.26,-.15,.035,.43,1.65);for(const dz of [-1.2,1.2]){const wheel=cyl(g,M.black,side*.93,.4,dz,.34,.34,.2,20);wheel.rotation.z=Math.PI/2;}}
    for(const dx of [-.6,.6])box(g,M.cream,dx,.7,-1.92,.38,.17,.05);
    obstacle(x,z,turn?2:1.05,turn?1.05:2);
  }
  car(-4,-26,0x7c9ba4);car(4,28,0xbc7157,Math.PI);car(28,-3,0xc8ba86,Math.PI/2);car(-33,3,0x758c80,Math.PI/2);
  for(const [x,z] of [[-20,14],[-9,33],[16,22]]){
    const g=place(x,z);box(g,M.wood,0,.6,0,3,.12,.65);box(g,M.wood,0,1,-.4,3,.7,.12);
    for(const dx of [-1.1,1.1])box(g,M.metal,dx,.3,0,.09,.6,.5);
  }
  const sign=place(0,35);for(const x of [-4,4])cyl(sign,M.metal,x,3.3,0,.09,.09,6.6);
  label('WITAJ W KOZOPOLIS',0,0,5.7,sign,9);
  const fountain=place(20,11);cyl(fountain,M.stone,0,.35,0,2.2,2.4,.7,48);cyl(fountain,mat(0x649994,{metalness:.3,roughness:.2}),0,.73,0,2,2,.035,48);
  cyl(fountain,M.stone,0,1.4,0,.3,.55,1.5);ell(fountain,M.cream,0,2.45,0,.6,.65,.6);obstacle(20,11,2.4,2.4);
  label('PARK KOZIEGO GŁOSU',-16,34,2.5,root,6);
  root.visible=false;return root;
}
