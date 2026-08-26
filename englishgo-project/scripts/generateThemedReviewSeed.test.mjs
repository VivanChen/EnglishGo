import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderThemedReviewSeed } from "./generateThemedReviewSeed.mjs";

describe("themed review Supabase seed",()=>{
  it("stays synchronized with the local fallback word bank",()=>{
    const generated=renderThemedReviewSeed();
    const checkedIn=readFileSync("supabase/upsert_themed_review_words_20260826.sql","utf8");

    expect(checkedIn).toBe(generated);
    expect(generated.match(/ThemedReview:/g)).toHaveLength(202);
    expect(generated).toContain("ON CONFLICT (word, level) DO UPDATE SET");
  });
});
