import { describe, expect, it } from 'vitest';
import { CHAPTERS, FURNITURE, LEVELS, PETS, REGIONS } from './worldData.js';
import { createWorld, validatePlacement } from './worldState.js';

describe('the original island story catalog', () => {
  it('contains exactly three distinct original companions and three complete furnishing sets', () => {
    expect(PETS.map(pet => pet.id)).toEqual(['harbor-cat', 'sunny-dog', 'garden-rabbit']);
    expect(new Set(PETS.map(pet => pet.species)).size).toBe(3);
    expect(FURNITURE).toHaveLength(24);
    expect(new Set(FURNITURE.map(item => item.id)).size).toBe(24);
    for (const region of REGIONS) expect(FURNITURE.filter(item => item.setId === region.id)).toHaveLength(8);
    for (const item of FURNITURE) {
      expect(item.name).toMatch(/[\u3400-\u9fff]/);
      expect(item.enName).toMatch(/[a-z]/i);
      expect(item.price).toBeGreaterThan(0);
      expect(item.size.x).toBeGreaterThan(0);
      expect(item.size.z).toBeGreaterThan(0);
    }
  });

  it('keeps all 54 challenges bilingual, answerable, distinct and tied to a complete chapter', () => {
    expect(CHAPTERS).toHaveLength(9);
    expect(CHAPTERS.map(chapter => chapter.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const prompts = [], questionIds = [];
    for (const region of REGIONS) expect(CHAPTERS.filter(chapter => chapter.regionId === region.id)).toHaveLength(3);
    for (const chapter of CHAPTERS) {
      expect(Object.keys(chapter.levels)).toEqual(LEVELS);
      expect(chapter.rewardItemIds.length).toBeGreaterThan(0);
      for (const itemId of chapter.rewardItemIds) expect(FURNITURE.some(item => item.id === itemId)).toBe(true);
      for (const level of LEVELS) {
        const story = chapter.levels[level];
        expect(story.intro.en.length).toBeGreaterThan(30);
        expect(story.intro.zh).toMatch(/[\u3400-\u9fff]/);
        expect(story.challenges).toHaveLength(2);
        for (const challenge of story.challenges) {
          questionIds.push(challenge.id); prompts.push(challenge.prompt);
          expect(challenge.zh).toMatch(/[\u3400-\u9fff]/);
          expect(challenge.options).toHaveLength(3);
          expect(new Set(challenge.options.map(option => option.en)).size).toBe(3);
          expect(Number.isInteger(challenge.answer)).toBe(true);
          expect(challenge.options[challenge.answer]).toBeDefined();
          expect(challenge.explanation.en.length).toBeGreaterThan(20);
          expect(challenge.explanation.zh).toMatch(/[\u3400-\u9fff]/);
          for (const option of challenge.options) {
            expect(option.en).toMatch(/[a-z]/i);
            expect(option.zh).toMatch(/[\u3400-\u9fff]/);
          }
        }
      }
    }
    expect(new Set(questionIds).size).toBe(54);
    expect(new Set(prompts).size).toBe(54);
  });

  it('grounds upper-level questions in relevant reasoning instead of replacing a few words', () => {
    const arrival = CHAPTERS[0].levels;
    expect(arrival.elementary.intro.en).toContain('blue fish');
    expect(arrival.junior.intro.en).toContain('beside the wooden bench');
    expect(arrival.senior.intro.en).toContain('steep staircase');
    expect(arrival.senior.challenges[0].options[arrival.senior.challenges[0].answer].en).toContain('step-free');
    const trail = CHAPTERS[6].levels.senior;
    expect(trail.intro.en).toContain('this morning');
    expect(trail.challenges[0].options[trail.challenges[0].answer].en).toContain('morning');
    const finale = CHAPTERS[8].levels.senior;
    expect(finale.challenges[1].options[finale.challenges[1].answer].en).toContain('cloudy');
  });

  it('starts with owned, usable furnishings that leave a clear walking path', () => {
    const world = createWorld();
    expect(world.placements).toHaveLength(3);
    for (const placement of world.placements) {
      expect(world.ownedDecorations).toContain(placement.itemId);
      expect(validatePlacement(world, placement).ok).toBe(true);
    }
  });
});
