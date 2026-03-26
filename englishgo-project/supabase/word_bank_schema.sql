-- ═══════════════════════════════════════════════════════════════
-- EnglishGo — word_bank 單字庫表格
-- 在 Supabase SQL Editor 中執行此檔案
-- ═══════════════════════════════════════════════════════════════

-- 主要單字庫（對應大考中心 7000 字 Level 1-6）
CREATE TABLE IF NOT EXISTS public.word_bank (
  id BIGSERIAL PRIMARY KEY,
  word TEXT NOT NULL,
  phonetic TEXT DEFAULT '',
  pos TEXT DEFAULT '',             -- n. / v. / adj. / adv. etc.
  meaning TEXT NOT NULL,           -- 中文意思
  level TEXT NOT NULL CHECK (level IN ('elementary', 'junior', 'senior')),
  ceec_level INT DEFAULT 1 CHECK (ceec_level BETWEEN 1 AND 6),
  forms JSONB DEFAULT '[]',        -- [{w:"ran", p:"v.", n:"過去式"}]
  collocations JSONB DEFAULT '[]', -- ["run fast 跑得快"]
  example TEXT DEFAULT '',
  example_zh TEXT DEFAULT '',
  category TEXT DEFAULT '',        -- Food, Animals, School, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(word, level)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_wb_level ON public.word_bank(level);
CREATE INDEX IF NOT EXISTS idx_wb_ceec ON public.word_bank(ceec_level);
CREATE INDEX IF NOT EXISTS idx_wb_category ON public.word_bank(category);

-- RLS: 所有人可讀，只有 admin 可寫
ALTER TABLE public.word_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_bank is publicly readable"
  ON public.word_bank FOR SELECT
  USING (true);

-- 如果需要讓登入使用者也能新增自訂單字，可加這條：
-- CREATE POLICY "authenticated users can insert"
--   ON public.word_bank FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');

-- ═══ 統計用 View ═════════════════════════════════════════════
CREATE OR REPLACE VIEW public.word_bank_stats AS
SELECT 
  level,
  COUNT(*) as total_words,
  COUNT(DISTINCT category) as categories
FROM public.word_bank
GROUP BY level;
