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
});
