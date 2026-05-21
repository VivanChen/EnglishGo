import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SENIOR_SONGS } from "./seniorSongs.js";

describe("senior songs", () => {
  it("includes Taipei Cipher as a playable senior high song", () => {
    const song = SENIOR_SONGS.find((item) => item.id === "senior-taipei-cipher");

    expect(song).toBeTruthy();
    expect(song.title).toBe("Taipei Cipher");
    expect(song.audio).toBe("/audio/songs/senior-taipei-cipher.mp3");
    expect(song.cover).toBe("/images/songs/senior-taipei-cipher-cover.svg");
    expect(existsSync("public/audio/songs/senior-taipei-cipher.mp3")).toBe(true);
    expect(existsSync("public/images/songs/senior-taipei-cipher-cover.svg")).toBe(true);
    expect(song.level).toBe("高中");
    expect(song.vocab.length).toBeGreaterThanOrEqual(12);
    expect(song.patterns.length).toBeGreaterThanOrEqual(4);
  });

  it("has increasing timed lyrics with translations for Taipei Cipher", () => {
    const song = SENIOR_SONGS.find((item) => item.id === "senior-taipei-cipher");
    const timedLines = song.lines.filter((line) => Number.isFinite(line.t));

    expect(timedLines.length).toBeGreaterThan(20);
    expect(timedLines.every((line) => line.en && line.zh)).toBe(true);
    expect(timedLines.map((line) => line.t)).toEqual([...timedLines.map((line) => line.t)].sort((a, b) => a - b));
  });

  it("uses calibrated Taipei Cipher timestamps exported from Timing Lab", () => {
    const song = SENIOR_SONGS.find((item) => item.id === "senior-taipei-cipher");
    const byText = (text) => song.lines.find((line) => line.en === text);
    const timesFor = (text) => song.lines.filter((line) => line.en === text).map((line) => line.t);

    expect(byText("Check the mind state, word up, yeah we on a mission.").t).toBe(11.6);
    expect(byText("English vibe, we do it our way! Word up!").t).toBe(50.2);
    expect(byText("Adjectives illuminate the path, make the description vivid.").t).toBe(68.9);
    expect(timesFor("From the island to the globe, let the lyric play!")).toContain(119.5);
    expect(byText("Peace to the high school students in Taipei, word up. Peace.").t).toBe(146);
  });
});
