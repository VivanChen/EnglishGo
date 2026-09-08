import {describe,it,expect} from 'vitest';
import {ISLAND_DECKS,ISLAND_TOOLS,drawIslandEvent} from './petIslandEvents.js';
describe('island event decks',()=>{
  it('draws without replacement and keeps fate separate from chance',()=>{
    let piles={},seen=[];
    for(let i=0;i<6;i++){const draw=drawIslandEvent('chance',piles,()=>.4);seen.push(draw.card.id);piles=draw.piles}
    expect(new Set(seen).size).toBe(6);expect(piles.chance).toHaveLength(0);expect(piles.fate).toBeUndefined();
    const next=drawIslandEvent('chance',piles,()=>.8);expect(next.piles.chance).toHaveLength(5);
    const fate=drawIslandEvent('fate',next.piles,()=>.2);expect(fate.piles.chance).toEqual(next.piles.chance);expect(ISLAND_DECKS.fate).toContain(fate.card);
  });
  it('never mutates input piles and only awards usable tools',()=>{
    const pile=[...ISLAND_DECKS.chance],before=[...pile];drawIslandEvent('chance',{chance:pile});expect(pile).toEqual(before);
    for(const card of Object.values(ISLAND_DECKS).flat()){
      expect(card.options.some(option=>!option.cost||option.debt)).toBe(true);
      for(const option of card.options)if(option.card)expect(ISLAND_TOOLS.some(tool=>tool.id===option.card)).toBe(true);
    }
  });
});
