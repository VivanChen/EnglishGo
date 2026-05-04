-- EnglishGo support messages
-- Run in Supabase SQL Editor if the table is not already present.

CREATE TABLE IF NOT EXISTS public.sponsor_messages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sponsor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit sponsor messages" ON public.sponsor_messages;
DROP POLICY IF EXISTS "Public can submit sponsor messages" ON public.sponsor_messages;

CREATE POLICY "Public can submit sponsor messages"
  ON public.sponsor_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 60
    AND char_length(message) <= 500
  );

GRANT INSERT ON TABLE public.sponsor_messages TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sponsor_messages_id_seq TO anon, authenticated;
