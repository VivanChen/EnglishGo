export const CLOUD_VOCABULARY_PAGE_SIZE = 1000;

export async function fetchAllCloudVocabularyRows(
  supabase,
  level,
  select,
  pageSize = CLOUD_VOCABULARY_PAGE_SIZE,
) {
  if (!supabase || !level || !select) return null;

  const size = Math.max(1, Number(pageSize) || CLOUD_VOCABULARY_PAGE_SIZE);
  const rows = [];

  for (let start = 0; ; start += size) {
    const { data, error } = await supabase
      .from("word_bank")
      .select(select)
      .eq("level", level)
      .order("id", { ascending: true })
      .range(start, start + size - 1);

    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < size) break;
  }

  return rows;
}
