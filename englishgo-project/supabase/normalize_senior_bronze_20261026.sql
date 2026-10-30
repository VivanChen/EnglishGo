-- Normalize a senior headword before creating its illustration; preserve its ID and content.
begin;
do $guard$ begin
if exists(select 1 from public.word_bank where level='senior' and lower(word)='bronze' and id<>4104) then raise exception 'Another bronze row exists'; end if;
if exists(select 1 from public.word_illustrations where level='senior' and word='Bronze') then raise exception 'Existing Bronze illustration requires separate reconciliation'; end if;
end $guard$;
update public.word_bank set word='bronze' where id=4104 and level='senior' and word='Bronze';
commit;
