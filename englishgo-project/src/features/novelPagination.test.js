import { describe, expect, it } from "vitest";
import {
  findPageForBlock,
  nextSpreadStart,
  paginateByHeight,
  previousSpreadStart,
  spreadStartForPage,
} from "./novelPagination.js";

describe("novel pagination", () => {
  it("groups measured blocks within the available page height", () => {
    const blocks = [{ i: 0 }, { i: 1 }, { i: 2 }, { i: 3 }];

    expect(paginateByHeight(blocks, [90, 120, 80, 150], 250, 10)).toEqual([
      [blocks[0], blocks[1]],
      [blocks[2], blocks[3]],
    ]);
  });

  it("keeps an oversized block on its own page", () => {
    const blocks = [{ i: 0 }, { i: 1 }];

    expect(paginateByHeight(blocks, [400, 80], 250, 10)).toEqual([
      [blocks[0]],
      [blocks[1]],
    ]);
  });

  it("aligns desktop spreads and advances by the visible page count", () => {
    expect(spreadStartForPage(5, 2)).toBe(4);
    expect(nextSpreadStart(4, 7, 2)).toBe(6);
    expect(previousSpreadStart(4, 2)).toBe(2);
    expect(nextSpreadStart(2, 7, 1)).toBe(3);
  });

  it("finds the page containing a source block", () => {
    const pages = [[{ i: 0 }, { i: 1 }], [{ i: 2 }], [{ i: 3 }]];

    expect(findPageForBlock(pages, 2)).toBe(1);
    expect(findPageForBlock(pages, 99)).toBe(0);
  });
});
