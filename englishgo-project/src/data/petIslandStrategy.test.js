import {describe,it,expect} from 'vitest';
import {getIslandRoutes,getIslandIncome,getIslandGoalProgress} from './petIslandStrategy.js';
describe('island planning',()=>{
  it('offers two distinct destinations, wraps the island, and previews boost before spending it',()=>{
    for(let face=1;face<=6;face++){
      const routes=getIslandRoutes(face,22,24,true);
      expect(routes[0].steps).toBe(face+2);expect(routes[1].steps).toBe(9-face);
      expect(routes[0].index).not.toBe(routes[1].index);expect(routes.every(r=>r.index>=0&&r.index<24)).toBe(true);
    }
  });
  it('makes a district pay once per type rather than once per pair',()=>{
    const tiles=[{id:'a',type:'word'},{id:'b',type:'word'},{id:'c',type:'word'},{id:'d',type:'shop'}];
    expect(getIslandIncome({a:{level:1},b:{level:2},c:{level:1},d:{level:1}},tiles)).toEqual({base:10,bonus:4,total:14,districts:['word']});
    expect(getIslandIncome({},tiles).total).toBe(0);
  });
  it('tracks building, exploration, and architecture goals from real game state',()=>{
    const owned={a:{level:3},b:{level:1}};
    expect(getIslandGoalProgress('builder',owned)).toBe(2);
    expect(getIslandGoalProgress('architect',owned)).toBe(3);
    expect(getIslandGoalProgress('explorer',{},['start','word','word','shop','event'])).toBe(3);
  });
});
