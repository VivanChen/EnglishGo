import { describe, expect, it } from "vitest";
import { EXTRA_WORDS } from "./extraWords.js";
import {
  countWeakVocabularyCards,
  filterCardsByTopic,
  getVocabularyTopicCatalog,
  mergeUniqueWordCards,
  parseVocabularyTopics,
  selectVocabularyTopicRound,
} from "./vocabularyTopics.js";

function byId(cards) {
  return Object.fromEntries(getVocabularyTopicCatalog(cards).map(topic => [topic.id, topic]));
}

describe("vocabulary topic coverage", () => {
  it("keeps one card per English word when local sources overlap", () => {
    const merged=mergeUniqueWordCards(
      [{w:"Apple",m:"蘋果"},{w:"bus",m:"公車"}],
      [{w:"apple",m:"蘋果（補充）"},{w:"train",m:"火車"}],
    );

    expect(merged.map(card=>card.w)).toEqual(["Apple","bus","train"]);
  });

  it("restores valid topic tags from Supabase themed categories",()=>{
    expect(parseVocabularyTopics("ThemedReview:transport,people,transport,unknown")).toEqual(["transport","people"]);
    expect(parseVocabularyTopics("Supplemental")).toEqual([]);
  });

  it("prioritizes weak words, then brings fresh cards into the next round",()=>{
    const cards=["weak","old","fresh one","fresh two"].map(w=>({w}));
    const picked=selectVocabularyTopicRound(cards,{
      weakWords:[{w:"weak",n:3}],
      previousWords:["weak","old"],
      limit:3,
      random:()=>0.5,
    });

    expect(picked.map(card=>card.w)).toEqual(["weak","fresh one","fresh two"]);
    expect(countWeakVocabularyCards([...cards,{w:"WEAK"}],[{w:"weak",n:3}])).toBe(1);
  });

  it("has enough elementary food and transport words for full topic rounds", () => {
    const coverage=byId(EXTRA_WORDS.elementary);

    expect(coverage.all.count).toBe(871);
    expect(coverage.food).toMatchObject({count:88,status:"ready",ready:true,gap:0});
    expect(coverage.transport).toMatchObject({count:35,status:"ready",ready:true,gap:0});
  });

  it("fills every junior review topic to at least one complete round", () => {
    const coverage=byId(EXTRA_WORDS.junior);

    expect(coverage.all.count).toBe(199);
    expect(coverage.transport).toMatchObject({count:21,status:"ready",ready:true,gap:0});
    expect(coverage.food).toMatchObject({count:21,status:"ready",ready:true,gap:0});
    expect(coverage.business).toMatchObject({count:22,status:"ready",ready:true,gap:0});
    expect(Object.values(coverage).every(topic=>topic.ready)).toBe(true);
  });

  it("fills every senior review topic to at least one complete round", () => {
    const coverage=byId(EXTRA_WORDS.senior);

    expect(coverage.all.count).toBe(116);
    expect(coverage.food).toMatchObject({count:21,status:"ready",ready:true,gap:0});
    expect(coverage.transport).toMatchObject({count:21,status:"ready",ready:true,gap:0});
    expect(coverage.school).toMatchObject({count:20,status:"ready",ready:true,gap:0});
    expect(coverage.people).toMatchObject({count:21,status:"ready",ready:true,gap:0});
    expect(coverage.nature).toMatchObject({count:20,status:"ready",ready:true,gap:0});
    expect(Object.values(coverage).every(topic=>topic.ready)).toBe(true);
  });

  it("classifies by the headword meaning instead of incidental example context",()=>{
    const transportWords=filterCardsByTopic(EXTRA_WORDS.senior,"transport").map(card=>card.w);

    expect(transportWords).toContain("highway");
    expect(transportWords).not.toContain("statistics");
    expect(transportWords).not.toContain("frequency");
  });

  it("filters a practice deck to the selected topic", () => {
    const transport=filterCardsByTopic(EXTRA_WORDS.junior,"transport");
    const words=transport.map(card=>card.w);

    expect(words).toContain("train");
    expect(words).toContain("station");
    expect(words).not.toContain("candle");
  });
});
