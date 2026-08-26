import { describe, expect, it } from "vitest";
import {
  JUNIOR_THEMED_REVIEW_WORDS,
  SENIOR_THEMED_REVIEW_WORDS,
} from "./themedReviewWords.js";
import { VOCABULARY_TOPICS } from "./vocabularyTopics.js";

const VALID_TOPICS=new Set(VOCABULARY_TOPICS.map(topic=>topic.id).filter(id=>id!=="all"));
const HAS_CJK=/[\u3400-\u9fff]/;
const LOW_QUALITY_PATTERNS=[
  /^I like\b/i,
  /^This is\b/i,
  /today's lesson picture/i,
  /with my classmates after school/i,
  /easy to understand/i,
];

function checkWordBank(level,cards,expectedCount){
  expect(cards).toHaveLength(expectedCount);
  expect(new Set(cards.map(card=>card.w.toLowerCase())).size).toBe(cards.length);
  expect(new Set(cards.map(card=>card.ex)).size).toBe(cards.length);

  for(const card of cards){
    expect(card.w,`${level} word`).toBeTruthy();
    expect(card.m,`${card.w} meaning`).toMatch(HAS_CJK);
    expect(card.p,`${card.w} part of speech`).toBeTruthy();
    expect(card.ex,`${card.w} example`).toMatch(/[A-Za-z]/);
    expect(card.ex.length,`${card.w} example should carry a real context`).toBeGreaterThanOrEqual(35);
    expect(card.ez,`${card.w} Chinese example`).toMatch(HAS_CJK);
    expect(card.topics.length,`${card.w} topics`).toBeGreaterThan(0);
    expect(card.topics.every(topic=>VALID_TOPICS.has(topic)),`${card.w} topic ids`).toBe(true);
    expect(LOW_QUALITY_PATTERNS.some(pattern=>pattern.test(card.ex)),`${card.w} canned example`).toBe(false);
    expect(card.c.length,`${card.w} collocation`).toBeGreaterThan(0);
    expect(card.c.every(item=>/[A-Za-z]/.test(item)&&HAS_CJK.test(item)),`${card.w} bilingual collocation`).toBe(true);
  }
}

describe("themed review word quality",()=>{
  it("adds junior vocabulary with unique, everyday bilingual examples",()=>{
    checkWordBank("junior",JUNIOR_THEMED_REVIEW_WORDS,86);
  });

  it("adds senior vocabulary with unique, age-appropriate bilingual examples",()=>{
    checkWordBank("senior",SENIOR_THEMED_REVIEW_WORDS,116);
  });

  it("does not repeat the same English headword across the new grade banks",()=>{
    const junior=new Set(JUNIOR_THEMED_REVIEW_WORDS.map(card=>card.w.toLowerCase()));
    const overlap=SENIOR_THEMED_REVIEW_WORDS.filter(card=>junior.has(card.w.toLowerCase()));
    expect(overlap).toEqual([]);
  });
});
