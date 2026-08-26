import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  JUNIOR_THEMED_REVIEW_WORDS,
  SENIOR_THEMED_REVIEW_WORDS,
} from "../src/data/themedReviewWords.js";

const sqlText = value => String(value ?? "").replaceAll("'", "''");
const jsonb = value => `'${sqlText(JSON.stringify(value ?? []))}'::jsonb`;

export function renderThemedReviewSeed() {
  const rows = [
    ...JUNIOR_THEMED_REVIEW_WORDS.map(card => ({ ...card, level: "junior", ceecLevel: 3 })),
    ...SENIOR_THEMED_REVIEW_WORDS.map(card => ({ ...card, level: "senior", ceecLevel: 5 })),
  ];
  const values = rows.map(card => `  ('${sqlText(card.w)}', '${sqlText(card.p)}', '${sqlText(card.m)}', '${card.level}', ${card.ceecLevel}, '${sqlText(card.ex)}', '${sqlText(card.ez)}', 'ThemedReview:${card.topics.join(",")}', '${sqlText(card.ph)}', ${jsonb(card.f)}, ${jsonb(card.c)})`).join(",\n");

  return `-- EnglishGo themed SRS review vocabulary\n-- Generated from src/data/themedReviewWords.js. Safe to re-run.\n\nINSERT INTO public.word_bank\n  (word, pos, meaning, level, ceec_level, example, example_zh, category, phonetic, forms, collocations)\nVALUES\n${values}\nON CONFLICT (word, level) DO UPDATE SET\n  pos = EXCLUDED.pos,\n  meaning = EXCLUDED.meaning,\n  ceec_level = EXCLUDED.ceec_level,\n  example = EXCLUDED.example,\n  example_zh = EXCLUDED.example_zh,\n  category = EXCLUDED.category,\n  phonetic = EXCLUDED.phonetic,\n  forms = EXCLUDED.forms,\n  collocations = EXCLUDED.collocations;\n`;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const outputPath = join(dirname(scriptPath), "..", "supabase", "upsert_themed_review_words_20260826.sql");
  writeFileSync(outputPath, renderThemedReviewSeed(), "utf8");
  console.log(`Updated ${outputPath}`);
}
