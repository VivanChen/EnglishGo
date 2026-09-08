import { describe, expect, it } from 'vitest';
import { completePetCare, refreshPetCare } from './petCare.js';
const now=new Date('2026-09-08T04:00:00Z');
const pet={petId:'bunny',level:2,exp:20,bond:380,hunger:30,clean:20,energy:10};
describe('care economy and absence',()=>{
  it('limits each kind of care reward and the three-kind bonus to once a day',()=>{
    const first=completePetCare(pet,'clean',null,now);
    expect(first.rewards).toEqual({coins:5,exp:10,bond:0});
    const again=completePetCare(first.pet,'clean',null,now);
    expect(again.rewards).toEqual({coins:0,exp:0,bond:0});
    const second=completePetCare(again.pet,'sleep',null,now);
    const third=completePetCare(second.pet,'study',null,now);
    expect(third.rewards).toEqual({coins:25,exp:60,bond:25});
    expect(third.pet.journey.marks).toBe(3);
    expect(completePetCare(third.pet,'study',null,now).rewards.coins).toBe(0);
    expect(completePetCare(third.pet,'study',null,new Date('2026-09-09T04:00:00Z')).first).toBe(true);
  });
  it('does not refill energy with repeated rest or lower accumulated bond',()=>{
    const first=completePetCare(pet,'sleep',null,now);
    expect(first.pet.energy).toBe(35);
    expect(completePetCare(first.pet,'sleep',null,now).pet.energy).toBe(35);
    expect(first.pet.bond).toBe(380);
  });
  it('requires a food and clears waste when washing',()=>{
    expect(completePetCare(pet,'feed',null,now)).toBeNull();
    expect(completePetCare(pet,'feed',{feed:25},now).pet.hunger).toBe(55);
    expect(completePetCare({...pet,poops:[{id:1}]},'clean',null,now).pet.poops).toEqual([]);
  });
  it('preserves legacy daily care rewards on migration',()=>{
    const legacy={...pet,careLog:{date:'2026-09-08',actions:['study'],comboClaimed:false}};
    expect(completePetCare(legacy,'study',null,now).rewards.coins).toBe(0);
  });
  it('caps absence impact and regenerates energy after a long break',()=>{
    const result=refreshPetCare({...pet,hunger:80,clean:80,lastUpdate:'2020-01-01'},now);
    expect(result).toMatchObject({hunger:64,clean:62,energy:100,bond:380});
    expect(result.poops).toHaveLength(2);
    expect(refreshPetCare(result,now)).toEqual(result);
  });
  it('handles corrupt/future timestamps without NaN or negative energy',()=>{
    expect(refreshPetCare({...pet,energy:-5,lastUpdate:'invalid'},now).energy).toBe(0);
    expect(refreshPetCare({...pet,lastUpdate:'2099-01-01'},now).energy).toBe(10);
  });
});
