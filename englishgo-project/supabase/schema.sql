-- ═══════════════════════════════════════════════════════════════
-- EnglishGo — Supabase Database Schema
-- 在 Supabase Dashboard > SQL Editor 中執行此檔案
-- ═══════════════════════════════════════════════════════════════

-- 1. 使用者資料表（Supabase Auth 會自動建立 auth.users）
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  current_level TEXT DEFAULT 'elementary' CHECK (current_level IN ('elementary', 'junior', 'senior')),
  xp INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 自訂單字庫
CREATE TABLE public.vocabulary (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('elementary', 'junior', 'senior')),
  word TEXT NOT NULL,
  phonetic TEXT,
  pos TEXT,
  meaning TEXT NOT NULL,
  forms JSONB DEFAULT '[]',
  collocations JSONB DEFAULT '[]',
  example TEXT,
  example_zh TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 單字卡 SRS 學習紀錄
CREATE TABLE public.flashcard_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  level TEXT NOT NULL,
  ease_factor REAL DEFAULT 2.5,          -- Anki ease factor
  interval_days INTEGER DEFAULT 0,        -- 下次複習間隔
  repetitions INTEGER DEFAULT 0,          -- 已複習次數
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_rating TEXT CHECK (last_rating IN ('again', 'hard', 'good', 'easy')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word, level)
);

-- 4. 測驗歷史
CREATE TABLE public.quiz_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('vocabulary', 'grammar', 'reading')),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  details JSONB DEFAULT '{}',             -- 每題答對/答錯細節
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 每日學習目標
CREATE TABLE public.daily_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_date DATE DEFAULT CURRENT_DATE,
  target INTEGER DEFAULT 10,
  completed INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, goal_date)
);

-- 6. AI 對話紀錄（選配，方便回顧）
CREATE TABLE public.ai_chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 索引 ═══════════════════════════════════════════════════════════
CREATE INDEX idx_vocab_user_level ON public.vocabulary(user_id, level);
CREATE INDEX idx_flashcard_user_review ON public.flashcard_progress(user_id, next_review_date);
CREATE INDEX idx_quiz_user ON public.quiz_history(user_id, created_at DESC);
CREATE INDEX idx_daily_user_date ON public.daily_goals(user_id, goal_date);

-- ═══ RLS 政策（Row Level Security）══════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- 每個使用者只能存取自己的資料
CREATE POLICY "Users can CRUD own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can CRUD own vocabulary" ON public.vocabulary FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own flashcard_progress" ON public.flashcard_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own quiz_history" ON public.quiz_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own daily_goals" ON public.daily_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own ai_chat_history" ON public.ai_chat_history FOR ALL USING (auth.uid() = user_id);

-- ═══ 自動建立 profile 的 Trigger ═════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
