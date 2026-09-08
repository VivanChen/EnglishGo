import { describe,it,expect } from 'vitest';
import { mergePetSaves } from './petSaveMerge.js';
import { completePetCare } from './petCare.js';
describe('pet save reconciliation',()=>{
  it('does not multiply shared coins, food or pending rewards on repeated merge',()=>{
    const save={pets:[],eggs:[{id:'1',petId:'bunny',progress:10,pendingDuplicateReward:{exp:40,bond:4,dupes:1}}],coins:100,inventory:{apple:3}};
    const merged=mergePetSaves(save,save);
    expect(merged).toEqual(save);
    expect(mergePetSaves(merged,save)).toEqual(save);
  });
  it('retains better progression, all skills, and recent care on both devices',()=>{
    const local={pets:[{petId:'bunny',level:2,exp:30,bond:400,skills:['heal'],journey:{marks:5,day:'2026-09-08',today:['clean']},careLog:{date:'2026-09-08',actions:['clean']},lastUpdate:'2026-09-08T09:00:00Z'}],inventory:{apple:2},coins:80};
    const cloud={pets:[{petId:'bunny',level:3,exp:10,bond:200,skills:['fire'],journey:{marks:6,day:'2026-09-08',today:['feed']},careLog:{date:'2026-09-08',actions:['feed'],comboClaimed:true},lastUpdate:'2026-09-08T08:00:00Z'}],inventory:{fish:3},coins:120};
    const result=mergePetSaves(local,cloud);
    expect(result.pets[0]).toMatchObject({level:3,exp:10,bond:400,journey:{marks:6},careLog:{comboClaimed:true}});
    expect(result.pets[0].skills).toEqual(expect.arrayContaining(['heal','fire']));
    expect(result.pets[0].careLog.actions).toEqual(expect.arrayContaining(['feed','clean']));
    expect(result).toMatchObject({inventory:{apple:2,fish:3},coins:120});
  });
  it('keeps today’s reward markers even if an older care record was saved more recently',()=>{
    const a={pets:[{petId:'bunny',level:1,exp:20,lastUpdate:'2026-09-08T12:00:00Z',journey:{day:'2026-09-07',marks:2,today:['feed']},careLog:{date:'Mon Sep 07 2026',actions:['feed']}}]};
    const b={pets:[{petId:'bunny',level:1,exp:10,lastUpdate:'2026-09-08T10:00:00Z',journey:{day:'2026-09-08',marks:3,today:['study']},careLog:{date:'Tue Sep 08 2026',actions:['study'],comboClaimed:true}}],inventory:null};
    expect(mergePetSaves(a,b).pets[0]).toMatchObject({journey:{day:'2026-09-08',today:['study']},careLog:{date:'Tue Sep 08 2026',comboClaimed:true}});
  });
  it('normalizes old and new daily date formats before merging reward history',()=>{
    const a={pets:[{petId:'bunny',careLog:{date:'2026-09-08',actions:['clean']}}]};
    const b={pets:[{petId:'bunny',careLog:{date:'Tue Sep 08 2026',actions:['study']}}]};
    const merged=mergePetSaves(a,b).pets[0];
    expect(merged.careLog.actions).toEqual(expect.arrayContaining(['clean','study']));
    expect(completePetCare(merged,'clean',null,new Date('2026-09-08T12:00:00')).rewards.coins).toBe(0);
  });
  it('does not restore a consumed egg from an older cloud snapshot',()=>{
    const local={pets:[{petId:'bunny',hatchedEggIds:['egg1'],exp:40}]};
    const cloud={pets:[],eggs:[{id:'egg1',petId:'bunny',progress:10,pendingDuplicateReward:{exp:40,bond:4,dupes:1}},{id:'old-untracked',petId:'bunny',progress:10}]};
    expect(mergePetSaves(local,cloud).eggs.map(egg=>egg.id)).toEqual(['old-untracked']);
  });
});
