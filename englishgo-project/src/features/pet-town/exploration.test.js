import { describe,it,expect } from 'vitest';
import { EXPLORATION_PLACES, explorationPlacements, explorationReceipt } from './explorationData.js';
import { applyWorldAction,createWorld,migrateLegacyWorld } from './worldState.js';
import { getEnvironmentInteraction,findEnvironmentApproach } from './environmentInteractions.js';
import { validWorldState } from '../../../netlify/functions/pet-account.mjs';
const fresh=()=>applyWorldAction(createWorld(),{type:'ADOPT_STARTER',speciesId:'harbor-cat'}).world;
describe('exploration discoveries',()=>{
  it('gives every stop two reachable interactive props and bilingual clues',()=>{
    expect(new Set(EXPLORATION_PLACES.map(p=>p.id)).size).toBe(6);
    for(const p of EXPLORATION_PLACES){
      const placements=explorationPlacements(p);expect(placements).toHaveLength(2);
      for(const [i,t] of p.tasks.entries()){
        expect(getEnvironmentInteraction(placements[i])).toBeTruthy();
        expect(findEnvironmentApproach({x:0,z:1},placements[i],placements)).toBeTruthy();
        expect(t.en.length).toBeGreaterThan(20);expect(t.translation).toMatch(/[\u4e00-\u9fff]/);
        expect(t.options[t.answer]?.en).toBeTruthy();expect(t.options.every(o=>o.zh)).toBe(true);
      }
    }
  });
  it('persists all twelve stamps without changing story rewards, pets or coins',()=>{
    const initial=fresh();let world=initial;
    for(const p of EXPLORATION_PLACES)for(const t of p.tasks){
      const action={type:'EXPLORE_DISCOVERY',placeId:p.id,taskId:t.id,answer:t.answer};
      const result=applyWorldAction(world,action,{coins:50});world=result.world;
      expect(result.coinDelta).toBe(0);expect(applyWorldAction(world,action).world).toBe(world);
      expect(world.receipts).toContain(explorationReceipt(p.id,t.id));
    }
    expect(world.ownedPets).toEqual(initial.ownedPets);expect(world.completedChapters).toEqual([]);
    expect(world.journal.filter(e=>e.kind==='exploration')).toHaveLength(12);
    expect(migrateLegacyWorld(world).receipts).toEqual(world.receipts);expect(validWorldState(world)).toBe(true);
  });
  it('rejects invalid, incorrect and unadopted discoveries',()=>{
    const world=fresh(),base={type:'EXPLORE_DISCOVERY',placeId:'tidepool',taskId:'shell',answer:1};
    for(const patch of [{placeId:'unknown'},{taskId:'unknown'},{answer:0},{answer:'1'}])expect(applyWorldAction(world,{...base,...patch}).world).toBe(world);
    const empty=createWorld();expect(applyWorldAction(empty,base).world).toBe(empty);
  });
});
