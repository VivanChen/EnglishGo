import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ELEMENTARY_SONGS } from './elementarySongs.js';
import { JUNIOR_SONGS } from './juniorSongs.js';
import { SENIOR_SONGS } from './seniorSongs.js';

describe('recorded song timelines', () => {
  it.each([...ELEMENTARY_SONGS, ...JUNIOR_SONGS, ...SENIOR_SONGS])('$title has ordered bilingual cues', song => {
    expect(existsSync('public' + song.audio)).toBe(true);
    const lyrics = song.lines.filter(line => line.en);
    lyrics.forEach((line, index) => {
      expect(line.zh).toBeTruthy();
      expect(Number.isFinite(line.t)).toBe(true);
      expect(line.t).toBeGreaterThan(index ? lyrics[index - 1].t : -1);
      if (line.end !== undefined) {
        expect(Number.isFinite(line.end)).toBe(true);
        expect(line.end).toBeGreaterThan(line.t);
        if (lyrics[index + 1]) expect(line.end).toBeLessThanOrEqual(lyrics[index + 1].t);
      }
    });
  });

  it('matches the elementary recordings at instrumental breaks and repeated choruses', () => {
    const [step, happy, animal] = ELEMENTARY_SONGS;
    const times = (song, en) => song.lines.filter(line => line.en === en).map(line => line.t);
    expect(times(step, 'Step by step, I learn today,')).toEqual([34.9, 61.1]);
    expect(step.lines.find(line => line.en === 'English has no fear.').end).toBe(26);
    expect(times(happy, 'This is my happy, happy day,')).toEqual([25.6, 51.2]);
    expect(times(animal, 'A bee can buzz by me.')).toEqual([56.6]);
    expect(animal.lines.at(-1).end).toBe(68.4);
  });
});
