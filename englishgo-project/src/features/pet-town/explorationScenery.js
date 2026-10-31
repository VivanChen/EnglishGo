// Landmarks sit behind the walkable area; interactive props use the shared pathfinder.
export function buildExplorationScenery(scene, world, { group, box, ball, cylinder, roof, tree }) {
  if(!['tidepool','meadow','pond','market','camp','observatory'].includes(scene))return false;
  const landmark=group(world,[0,.05,-3]);
  landmark.name=`exploration-${scene}`;
  if(scene==='tidepool'||scene==='pond'){
    const pool=cylinder(landmark,scene==='pond'?'#7fb9b8':'#91c8ca',[0,.06,0],1.9,2,.12,40);pool.scale.z=.65;
    for(let i=0;i<13;i++){const a=i*Math.PI*2/13;ball(landmark,'#b7b7a5',[Math.cos(a)*2,.13,Math.sin(a)*1.3],[.3,.24,.25]);}
    if(scene==='pond')for(let i=0;i<5;i++){const x=-1.2+i*.55;cylinder(landmark,'#76916e',[x,.15,Math.sin(i)*.6],.22,.22,.025,12);ball(landmark,'#eed4cb',[x,.21,Math.sin(i)*.6],[.09,.08,.09]);}
    else for(let i=0;i<5;i++)ball(landmark,'#f0d9bf',[-1.5+i*.7,.18,1.55],[.18,.09,.14]);
  }else if(scene==='meadow'){
    for(const x of [-1.7,1.7])box(landmark,'#d6ccb1',[x,1.25,0],[.16,2.5,.16]);
    box(landmark,'#d6ccb1',[0,2.5,0],[3.6,.18,.25]);
    for(let i=0;i<9;i++){ball(landmark,'#87aa7a',[-1.7+i*.42,2.48,.08],[.36,.2,.3]);ball(landmark,i%2?'#efd3b5':'#d7b4c6',[-1.7+i*.42,2.64,.2],[.14,.14,.12]);}
    tree(world,-3.1,-3.4,.85,true);tree(world,3.1,-3.4,.85,true);
  }else if(scene==='market'){
    for(const x of [-1.7,1.7])box(landmark,'#b39573',[x,1.2,0],[.14,2.4,.14]);
    box(landmark,'#bd9670',[0,.65,.1],[3.5,1.2,.85]);
    box(landmark,'#ead9b9',[0,1.3,.1],[3.8,.14,1]);
    for(let i=0;i<8;i++)box(landmark,i%2?'#fff0cf':'#91b0a0',[-1.7+i*.48,2.45,0],[.48,.15,1.6]);
    for(let i=0;i<7;i++)ball(landmark,i%2?'#dbaf72':'#d78f7a',[-1.3+i*.42,1.47,.12],[.16,.14,.16]);
  }else if(scene==='camp'){
    const tent=group(landmark,[0,0,0]);roof(tent,3.7,2.2,2.2,'#c4ad7e');
    const opening=group(landmark,[0,.01,1.14]);roof(opening,1.7,.035,1.6,'#6c786a');
    for(const x of [-2.5,2.5])tree(world,x,-3.8,1.2);
  }else{
    cylinder(landmark,'#c8c6bc',[0,.18,0],2,2,.3,32);
    for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;box(landmark,'#9babb1',[Math.cos(a)*1.8,.7,Math.sin(a)*1.6],[.12,1.1,.12]);}
    const scope=group(landmark,[0,.6,0]);
    for(const x of [-.5,.5]){const leg=box(scope,'#a49d8a',[x,.35,0],[.09,.8,.09]);leg.rotation.z=-x*.8;}
    const tube=cylinder(scope,'#9caec0',[0,1.05,0],.22,.25,1.6,20);tube.rotation.z=-.9;
    ball(scope,'#dcebf0',[-.62,1.55,0],[.2,.08,.2]);
  }
  return true;
}
