const T=window.THREE;
export function createAnimalViews(scene,simulation){
 const mats=new Map();function mat(color){if(!mats.has(color))mats.set(color,new T.MeshLambertMaterial({color}));return mats.get(color);}
 const cube=new T.BoxGeometry(1,1,1);
 function box(parent,w,h,d,x,y,z,color){const m=new T.Mesh(cube,mat(color));m.scale.set(w,h,d);m.position.set(x,y,z);parent.add(m);return m;}
 const views=new Map();
 for(const a of simulation.animals){
  const root=new T.Group(),body=new T.Group();root.add(body);scene.add(root);const legs=[];
  const rabbit=a.kind==='rabbit',pig=a.kind==='pig',fur=pig?'#eca6ad':rabbit?'#c7aa86':'#fff7df',skin=pig?'#e594a0':rabbit?'#c7aa86':'#b9aa91';
  box(body,rabbit?.48:.85,rabbit?.38:.66,rabbit?.65:1.12,0,rabbit?.4:.73,0,fur);
  const head=new T.Group();head.position.set(0,rabbit?.62:.99,rabbit?.34:.56);body.add(head);
  box(head,rabbit?.4:.54,rabbit?.4:.5,rabbit?.38:.45,0,0,0,skin);
  if(pig){box(head,.33,.18,.13,0,-.1,.27,'#f3b7b6');for(const x of [-.08,.08])box(head,.045,.045,.02,x,-.1,.342,'#a46470');}
  for(const x of [-1,1]){
   box(head,rabbit?.13:.17,rabbit?.48:.22,.12,x*(rabbit?.12:.23),rabbit?.34:.3,-.04,fur);
   if(rabbit)box(head,.075,.32,.025,x*.12,.35,.027,'#e6b0ad');
   box(head,.1,.11,.04,x*.15,.04,.235,'#fffef3');box(head,.055,.075,.025,x*.15,.035,.261,'#283b32');
  }
  if(rabbit)box(head,.09,.07,.045,0,-.09,.22,'#e2a6a3');
  for(const x of [-1,1])for(const z of [-1,1]){const leg=new T.Group();leg.position.set(x*(rabbit?.16:.29),rabbit?.24:.42,z*(rabbit?.2:.38));body.add(leg);box(leg,rabbit?.13:.17,rabbit?.24:.42,rabbit?.2:.19,0,-(rabbit?.12:.21),0,skin);legs.push(leg);}
  box(body,rabbit?.2:.12,rabbit?.2:.12,rabbit?.18:.15,0,rabbit?.42:.8,rabbit?-.39:-.64,pig?'#df8e9a':fur);
  const hearts=new T.Group();root.add(hearts);
  // Small pixel hearts face the player; visible proof of feeding.
  for(let i=0;i<3;i++){const shape=new T.Shape();shape.moveTo(0,.06);for(const [x,y] of [[-.06,.13],[-.13,.13],[-.17,.08],[-.17,0],[0,-.18],[.17,0],[.17,.08],[.13,.13],[.06,.13],[0,.06]])shape.lineTo(x,y);const heart=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:'#f08ba5',side:T.DoubleSide}));heart.position.set((i-1)*.35,a.height+.4+(i%2)*.18,0);hearts.add(heart);}
  hearts.visible=false;views.set(a.id,{root,body,head,legs,hearts});
 }
 return {update(player){for(const a of simulation.animals){const v=views.get(a.id);v.root.position.set(a.x,a.y,a.z);v.body.rotation.y=a.angle;
  const phase=simulation.time*(a.kind==='rabbit'?12:8)+a.phase;
  v.legs.forEach((leg,i)=>leg.rotation.x=a.walking?Math.sin(phase+(i%2)*Math.PI)*.45:0);
  v.body.position.y=a.walking&&a.kind==='rabbit'?Math.abs(Math.sin(phase))*.11:0;
  v.head.rotation.x=a.happy>6?Math.sin(simulation.time*14)*.14:0;
  v.hearts.visible=a.happy>5;v.hearts.rotation.y=Math.atan2(player.x-a.x,player.z-a.z);v.hearts.position.y=a.happy>5?Math.sin(simulation.time*3)*.07:0;
 }}};
}
