export const ISLAND_GOALS = [
  {id:'builder',name:'小小建築師',icon:'⌂',target:3,description:'買下 3 棟屬於你的建築'},
  {id:'explorer',name:'環島探險家',icon:'⚑',target:4,description:'停留 4 種不同的地點'},
  {id:'architect',name:'夢想設計師',icon:'♜',target:3,description:'把一棟建築升到 3 級'},
];

export function getIslandGoalProgress(id,owned={},visited=[]){
  if(id==='explorer')return Math.min(4,new Set(visited.filter(type=>type!=='start')).size);
  if(id==='architect')return Math.max(0,...Object.values(owned).map(p=>Number(p.level)||1));
  return Math.min(3,Object.keys(owned).length);
}

// Two complementary dice guarantee different destinations without a reroll cost.
export function getIslandRoutes(base,position,total,boost=false){
  const face=Math.min(6,Math.max(1,Number(base)||1));
  return [face,7-face].map(value=>({face:value,steps:value+(boost?2:0),index:(position+value+(boost?2:0))%total}));
}

export function getIslandIncome(owned={},tiles=[]){
  const groups={};
  let base=0;
  for(const [id,property] of Object.entries(owned)){
    const type=tiles.find(tile=>tile.id===id)?.type;
    if(!type)continue;
    base+=2*(Number(property.level)||1);
    groups[type]=(groups[type]||0)+1;
  }
  const districts=Object.entries(groups).filter(([,count])=>count>=2).map(([type])=>type);
  return {base,bonus:districts.length*4,total:base+districts.length*4,districts};
}
