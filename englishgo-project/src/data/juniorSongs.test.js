import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { JUNIOR_SONGS } from "./juniorSongs.js";

describe("junior songs", () => {
  it("includes Dream in Color as a playable junior high song", () => {
    const song = JUNIOR_SONGS.find((item) => item.id === "junior-dream-in-color");

    expect(song).toBeTruthy();
    expect(song.title).toBe("Dream in Color");
    expect(song.audio).toBe("/audio/songs/junior-dream-in-color.mp3");
    expect(song.cover).toBe("/images/songs/junior-dream-in-color-cover.svg");
    expect(existsSync("public/images/songs/junior-dream-in-color-cover.svg")).toBe(true);
    expect(song.level).toBe("國中");
    expect(song.vocab.length).toBeGreaterThanOrEqual(10);
    expect(song.patterns.length).toBeGreaterThanOrEqual(3);
  });

  it("has increasing timed lyric lines with Chinese translations", () => {
    const song = JUNIOR_SONGS.find((item) => item.id === "junior-dream-in-color");
    const timedLines = song.lines.filter((line) => Number.isFinite(line.t));

    expect(timedLines.length).toBeGreaterThan(20);
    expect(timedLines.every((line) => line.en && line.zh)).toBe(true);
    expect(timedLines.map((line) => line.t)).toEqual([...timedLines.map((line) => line.t)].sort((a, b) => a - b));
  });

  it("uses calibrated Dream in Color timestamps exported from Timing Lab", () => {
    const song = JUNIOR_SONGS.find((item) => item.id === "junior-dream-in-color");
    const byText = (text) => song.lines.find((line) => line.en === text);
    const timesFor = (text) => song.lines.filter((line) => line.en === text).map((line) => line.t);

    expect(byText("숨겨왔던 너의 날개.").t).toBe(59);
    expect(byText("펼쳐봐 지금 이 순간에.").t).toBe(63.4);
    expect(byText("Think in English, dream in color!").t).toBe(98.8);
    expect(timesFor("Lights on, let the lesson begin!")).toContain(149.3);
    expect(byText("See ya! Unlock the vibe!").t).toBe(172.7);
  });
});
