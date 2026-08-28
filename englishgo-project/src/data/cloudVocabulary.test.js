import { describe, expect, it, vi } from "vitest";
import { fetchAllCloudVocabularyRows } from "./cloudVocabulary.js";

function makeSupabase(rows, errorAtStart = null) {
  const range = vi.fn((start, end) => Promise.resolve(
    start === errorAtStart
      ? { data: null, error: new Error("page failed") }
      : { data: rows.slice(start, end + 1), error: null },
  ));
  const order = vi.fn(() => ({ range }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, calls: { from, select, eq, order, range } };
}

describe("cloud vocabulary pagination", () => {
  it("loads every Supabase page without stopping at the default row limit", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, word: `word-${index + 1}` }));
    const { client, calls } = makeSupabase(rows);

    const result = await fetchAllCloudVocabularyRows(client, "senior", "id,word", 2);

    expect(result).toEqual(rows);
    expect(calls.range.mock.calls).toEqual([[0, 1], [2, 3], [4, 5]]);
    expect(calls.eq).toHaveBeenCalledWith("level", "senior");
  });

  it("returns null when cloud access is unavailable and surfaces page errors", async () => {
    await expect(fetchAllCloudVocabularyRows(null, "junior", "id,word", 2)).resolves.toBeNull();

    const { client } = makeSupabase([{ id: 1, word: "one" }, { id: 2, word: "two" }], 2);
    await expect(fetchAllCloudVocabularyRows(client, "junior", "id,word", 2)).rejects.toThrow("page failed");
  });
});
