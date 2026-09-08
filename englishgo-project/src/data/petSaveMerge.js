const number=value=>Math.max(0,Number(value)||0);
const dayKey=value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value;const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const maxima=(a,b)=>{a=a||{};b=b||{};return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(key=>[key,Math.max(number(a[key]),number(b[key]))]));};
const latest=(a,b)=>new Date(a.lastUpdate||a.updatedAt||a.date||0)>new Date(b.lastUpdate||b.updatedAt||b.date||0)?a:b;
const latestDaily=(a,b,field)=>!a?b:!b?a:new Date(a[field]||0)>new Date(b[field]||0)?a:b;
function mergePet(a,b){
  const advanced=(a.level||1)>(b.level||1)||(a.level||1)===(b.level||1)&&number(a.exp)>number(b.exp)?a:b;
  const recent=latest(a,b),journey={...(latestDaily(a.journey,b.journey,'day')||{}),marks:Math.max(number(a.journey?.marks),number(b.journey?.marks))};
  if(a.journey?.day===b.journey?.day)journey.today=[...new Set([...(a.journey?.today||[]),...(b.journey?.today||[])])];
  let careLog=latestDaily(a.careLog,b.careLog,'date');
  if(a.careLog&&b.careLog&&dayKey(a.careLog.date)&&dayKey(a.careLog.date)===dayKey(b.careLog.date))careLog={...careLog,actions:[...new Set([...(a.careLog.actions||[]),...(b.careLog.actions||[])])],comboClaimed:!!(a.careLog.comboClaimed||b.careLog.comboClaimed)};
  return {...a,...b,...recent,level:advanced.level,exp:advanced.exp,bond:Math.max(number(a.bond),number(b.bond)),dupes:Math.max(number(a.dupes),number(b.dupes)),skills:[...new Set([...(a.skills||[]),...(b.skills||[])])],hatchedEggIds:[...new Set([...(a.hatchedEggIds||[]),...(b.hatchedEggIds||[])])],playRecords:maxima(a.playRecords,b.playRecords),journey,careLog};
}
// Merging copies of a save must be idempotent; a login cannot mint money or food.
export function mergePetSaves(local={},cloud={}){
  const pets=new Map(),eggs=new Map();
  for(const pet of [...cloud.pets||[],...local.pets||[]]){const old=pets.get(pet.petId);pets.set(pet.petId,old?mergePet(old,pet):pet);}
  for(const egg of [...cloud.eggs||[],...local.eggs||[]]){const old=eggs.get(egg.id);eggs.set(egg.id,old?{...old,...egg,progress:Math.max(number(old.progress),number(egg.progress)),pendingDuplicateReward:maxima(old.pendingDuplicateReward,egg.pendingDuplicateReward)}:egg);}
  const consumed=new Set([...pets.values()].flatMap(p=>p.hatchedEggIds||[]));
  return {pets:[...pets.values()],eggs:[...eggs.values()].filter(egg=>!consumed.has(egg.id)),inventory:maxima(local.inventory,cloud.inventory),coins:Math.max(number(local.coins),number(cloud.coins))};
}
