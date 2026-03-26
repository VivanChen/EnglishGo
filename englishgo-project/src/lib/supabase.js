import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (url && key) ? createClient(url, key) : null

// Fetch vocabulary for a level, with random ordering and pagination
export async function fetchVocab(level, limit = 20, offset = 0) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('word_bank')
    .select('*')
    .eq('level', level)
    .range(offset, offset + limit - 1)
  if (error) { console.error('fetchVocab error:', error); return null }
  return data
}

// Fetch random N words for a session
export async function fetchRandomVocab(level, count = 20) {
  if (!supabase) return null
  // Supabase doesn't have ORDER BY RANDOM() natively,
  // so we fetch all IDs then pick random ones
  const { data: allIds, error: idErr } = await supabase
    .from('word_bank')
    .select('id')
    .eq('level', level)
  if (idErr || !allIds) return null
  
  // Shuffle and pick N
  const shuffled = allIds.sort(() => Math.random() - 0.5).slice(0, count)
  const ids = shuffled.map(r => r.id)
  
  const { data, error } = await supabase
    .from('word_bank')
    .select('*')
    .in('id', ids)
  if (error) return null
  
  // Re-shuffle the result
  return data.sort(() => Math.random() - 0.5)
}

// Get word count per level
export async function fetchWordCounts() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('word_bank')
    .select('level')
  if (error) return null
  const counts = { elementary: 0, junior: 0, senior: 0 }
  data.forEach(r => { if (counts[r.level] !== undefined) counts[r.level]++ })
  return counts
}

// Convert Supabase row to app format
export function toAppFormat(row) {
  return {
    w: row.word,
    ph: row.phonetic || '',
    p: row.pos || '',
    m: row.meaning,
    f: Array.isArray(row.forms) ? row.forms : JSON.parse(row.forms || '[]'),
    c: Array.isArray(row.collocations) ? row.collocations : JSON.parse(row.collocations || '[]'),
    ex: row.example || '',
    ez: row.example_zh || '',
    img: '',
  }
}
