-- Additive illustration catalog. Existing vocabulary and learner data are preserved.
create table if not exists public.word_illustrations (
  id text primary key,
  level text not null check (level in ('elementary', 'junior', 'senior')),
  word text not null,
  sense text not null,
  sort_order integer not null check (sort_order > 0),
  image_url text not null,
  local_path text not null default '',
  alt_zh text not null,
  example text not null,
  example_zh text not null,
  style text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (level, word, sort_order),
  foreign key (word, level) references public.word_bank(word, level)
);
alter table public.word_illustrations enable row level security;
revoke all on public.word_illustrations from anon, authenticated;
grant select on public.word_illustrations to anon, authenticated;
grant all on public.word_illustrations to service_role;
create policy "Published word illustrations are readable"
  on public.word_illustrations for select to anon, authenticated using (true);
