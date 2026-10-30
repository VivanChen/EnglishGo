import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const [command, batchArg, argument] = process.argv.slice(2);
if (!/^\d+$/.test(batchArg || '')) throw Error('Usage: node scripts/seniorWordIllustrationBatch.mjs COMMAND BATCH [ARGUMENT]');
const suffix = String(Number(batchArg)).padStart(3, '0');
const base = path.resolve('.superpowers/word-art');
const sourceFile = path.join(base, `senior-batch-${suffix}.json`);
const stagedFile = path.join(base, `senior-batch-${suffix}-staged.json`);
const qaDir = path.join(base, `senior-qa-${suffix}`);
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n'); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => { try { await fs.stat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const safeWithin = (file, root) => { const relative = path.relative(path.resolve(root), path.resolve(file)); return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative); };
const projectUrl = 'https://jbspxqebcrkilfcddluo.supabase.co';
const publicUrl = r => projectUrl + '/storage/v1/object/public/word-illustrations/' + r.storage_path.split('/').map(encodeURIComponent).join('/');
const sourceRoot = path.resolve('C:/Users/vevanchen/.codex/generated_images');
const outputRoot = path.resolve('public/images/vocabulary/senior');
const require = createRequire(import.meta.url);
const sharp = () => require('C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function get(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`GET ${new URL(url).pathname}: ${response.status}`);
  return response;
}
async function checkRemote(r) {
  const response = await get(publicUrl(r));
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.headers.get('content-type')?.includes('image/webp') || hash(bytes) !== r.staged_sha256) throw Error('Remote image mismatch: ' + r.word);
  const meta = await sharp()(bytes).metadata();
  if (meta.width !== 768 || meta.height !== 768 || meta.format !== 'webp') throw Error('Remote dimensions mismatch: ' + r.word);
}
async function api(table, select, filters = {}) {
  const config = await json(path.join(base, 'senior-import-public-config.json'));
  const all = [];
  for (let offset = 0;; offset += 500) {
    const url = new URL(projectUrl + '/rest/v1/' + table);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '500'); url.searchParams.set('offset', String(offset));
    url.searchParams.set('order', 'id.asc');
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const rows = await (await get(url, { apikey: config.anon })).json();
    all.push(...rows); if (rows.length < 500) return all;
  }
}
function validContent(r) {
  if (!r.example || !/[.!?]$/.test(r.example) || !r.example_zh || !r.alt_zh || !r.sense) throw Error('Incomplete bilingual content: ' + r.word);
}

if (command === 'stage') {
  const manifest = await json(sourceFile), records = [], sources = new Set();
  await fs.mkdir(outputRoot, { recursive: true });
  for (const r of manifest.records) {
    const sidecarFile = path.join(base, `senior-${suffix}-images`, r.word + '.json');
    if (!(await exists(sidecarFile))) continue;
    const sidecar = await json(sidecarFile), sourcePath = await fs.realpath(sidecar.source_path);
    if (!safeWithin(sourcePath, sourceRoot) || sources.has(sourcePath)) throw Error('Unsafe or duplicate generated source: ' + r.word);
    sources.add(sourcePath); validContent(r);
    const input = await fs.readFile(sourcePath), meta = await sharp()(input).metadata();
    if (meta.width !== meta.height || meta.width < 768) throw Error('Invalid source dimensions: ' + r.word);
    let payload;
    for (const quality of [82, 76, 68, 60]) { payload = await sharp()(input).resize(768, 768).webp({ quality, effort: 6 }).toBuffer(); if (payload.length <= 300000) break; }
    if (payload.length > 300000) throw Error('Image exceeds import limit: ' + r.word);
    const stagedPath = path.join(outputRoot, path.basename(r.storage_path));
    if (await exists(stagedPath)) { if (hash(await fs.readFile(stagedPath)) !== hash(payload)) throw Error('Staged image conflict: ' + r.word); }
    else await fs.writeFile(stagedPath, payload);
    records.push({ ...r, prompt: sidecar.prompt, source_path: sourcePath, source_sha256: hash(input), source_dimensions: [meta.width, meta.height], staged_path: stagedPath, staged_sha256: hash(payload), staged_bytes: payload.length, staged_dimensions: [768, 768], image_url: publicUrl(r), local_path: '', qa_reviewed: sidecar.qa_reviewed === true, status: 'staged' });
  }
  if (!records.length) throw Error('No generated images to stage');
  const staged = { ...manifest, planned_target_count: manifest.target_count, target_count: records.length, generated_count: records.length, staged_count: records.length, status: records.length === manifest.target_count ? 'assets_staged' : 'partial_assets_staged', records };
  await save(stagedFile, staged);
  console.log(JSON.stringify({ staged: records.length, planned: manifest.target_count, bytes: records.reduce((n, r) => n + r.staged_bytes, 0) }));
} else if (command === 'sheets') {
  const m = await json(stagedFile), count = 12;
  await fs.mkdir(qaDir, { recursive: true });
  for (let start = 0; start < m.records.length; start += count) {
    const group = m.records.slice(start, start + count), layers = [];
    for (let i = 0; i < group.length; i++) {
      const left = (i % 3) * 320, top = Math.floor(i / 3) * 350;
      layers.push({ input: await sharp()(group[i].staged_path).resize(320, 320).toBuffer(), left, top });
      const label = group[i].word.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      layers.push({ input: Buffer.from(`<svg width="320" height="30"><rect width="320" height="30" fill="white"/><text x="8" y="22" font-size="20" fill="black">${label}</text></svg>`), left, top: top + 320 });
    }
    await sharp()({ create: { width: 960, height: Math.ceil(group.length / 3) * 350, channels: 3, background: 'white' } }).composite(layers).png().toFile(path.join(qaDir, `sheet-${String(start / count + 1).padStart(3, '0')}.png`));
  }
  console.log(JSON.stringify({ sheets: Math.ceil(m.records.length / count), directory: qaDir }));
} else if (command === 'approve') {
  const m = await json(stagedFile), words = new Set((argument || '').split(','));
  for (const r of m.records) if (words.has(r.word)) {
    const file = path.join(base, `senior-${suffix}-images`, r.word + '.json');
    await save(file, { ...await json(file), qa_reviewed: true }); r.qa_reviewed = true;
  }
  await save(stagedFile, m);
  console.log(JSON.stringify({ reviewed: m.records.filter(r => r.qa_reviewed).length, total: m.records.length }));
} else if (command === 'content') {
  const m = await json(stagedFile), upload = await json(path.join(base, `senior-batch-${suffix}-upload-results.json`));
  if (upload.count !== m.records.length || m.records.some(r => !r.qa_reviewed || !upload.results.some(x => x.id === r.id && x.sha256 === r.staged_sha256))) throw Error('Reviewed and verified images required');
  const keys = ['id', 'level', 'word', 'sort_order', 'sense', 'alt_zh', 'example', 'example_zh', 'image_url', 'local_path', 'style', 'version'];
  const rows = m.records.map(r => Object.fromEntries(keys.map(k => [k, r[k]])));
  const content = m.records.map(({ source_id, word, meaning, example, example_zh, original_meaning, original_example, original_example_zh }) => ({ source_id, word, meaning, example, example_zh, original_meaning, original_example, original_example_zh }));
  for (const value of [JSON.stringify(content), JSON.stringify(rows)]) if (value.includes('$senior_content$') || value.includes('$senior_rows$')) throw Error('Content contains a reserved SQL delimiter');
  const typed = 'jsonb_to_recordset(batch_content) as c(source_id bigint,word text,meaning text,example text,example_zh text,original_meaning text,original_example text,original_example_zh text)';
  const sql = `-- Reviewed senior batch ${suffix}; all images remotely verified.\nbegin;\ndo $guard$ declare batch_content jsonb := $senior_content$${JSON.stringify(content)}$senior_content$::jsonb; begin\nperform 1 from public.word_bank w join ${typed} on w.id=c.source_id and w.word=c.word where w.level='senior' for update of w;\nif (select count(*) from public.word_bank w join ${typed} on w.id=c.source_id and w.word=c.word where w.level='senior' and ((w.meaning,w.example,w.example_zh) is not distinct from (c.original_meaning,c.original_example,c.original_example_zh) or (w.meaning,w.example,w.example_zh) is not distinct from (c.meaning,c.example,c.example_zh))) <> ${content.length} then raise exception 'Senior source rows changed; refusing overwrite'; end if;\nupdate public.word_bank w set meaning=c.meaning,example=c.example,example_zh=c.example_zh from ${typed} where w.id=c.source_id and w.level='senior' and w.word=c.word;\nend $guard$;\ninsert into public.word_illustrations(id,level,word,sort_order,sense,alt_zh,example,example_zh,image_url,local_path,style,version) select id,level,word,sort_order,sense,alt_zh,example,example_zh,image_url,local_path,style,version from jsonb_to_recordset($senior_rows$${JSON.stringify(rows)}$senior_rows$::jsonb) as r(id text,level text,word text,sort_order integer,sense text,alt_zh text,example text,example_zh text,image_url text,local_path text,style text,version integer) on conflict(id) do nothing;\ncommit;\n`;
  const seed = path.resolve(`supabase/seed_senior_word_illustrations_20261026_batch${suffix}.sql`);
  await fs.writeFile(seed, sql); console.log(seed);
} else if (command === 'catalog') {
  const m = await json(stagedFile);
  const catalogFile = 'src/data/wordIllustrations.json', fallbackFile = 'src/data/seniorIllustrationWords.json';
  const catalog = await json(catalogFile), fallback = await json(fallbackFile);
  const keys = ['id', 'level', 'word', 'sort_order', 'sense', 'alt_zh', 'example', 'example_zh', 'image_url', 'local_path', 'style', 'version'];
  for (const r of m.records) {
    validContent(r);
    const row = Object.fromEntries(keys.map(k => [k, r[k]]));
    const old = catalog.find(x => x.id === r.id);
    if (old && JSON.stringify(old) !== JSON.stringify(row)) throw Error('Existing catalog conflict: ' + r.word);
    if (!old) catalog.push(row);
    const card = { w: r.word, m: r.meaning, p: r.pos, ex: r.example, ez: r.example_zh, img: r.image_url, category: r.category, ceec_level: r.ceec_level };
    const oldCard = fallback.find(x => x.w === r.word);
    if (oldCard && JSON.stringify(oldCard) !== JSON.stringify(card)) throw Error('Existing fallback conflict: ' + r.word);
    if (!oldCard) fallback.push(card);
  }
  await save(catalogFile, catalog); await save(fallbackFile, fallback);
  await save(`docs/senior-word-illustrations-generation-batch${suffix}.json`, { ...m, status: 'cloud_published_verification_pending' });
  console.log(JSON.stringify({ added: m.records.length, senior_catalog: catalog.filter(r => r.level === 'senior').length }));
} else if (command === 'verify') {
  const m = await json(stagedFile);
  const rows = await api('word_illustrations', '*', { level: 'eq.senior' });
  const words = await api('word_bank', 'id,word,level,meaning,example,example_zh', { id: 'in.(' + m.records.map(r => r.source_id).join(',') + ')' });
  for (const r of m.records) {
    const illustration = rows.find(x => x.id === r.id), word = words.find(x => x.id === r.source_id);
    if (!illustration || !word) throw Error('Missing published row: ' + r.word);
    for (const k of ['word', 'level', 'sense', 'example', 'example_zh', 'alt_zh', 'image_url', 'local_path']) if (illustration[k] !== r[k]) throw Error('Illustration mismatch: ' + r.word + ' ' + k);
    for (const k of ['word', 'level', 'meaning', 'example', 'example_zh']) if (word[k] !== r[k]) throw Error('Word bank mismatch: ' + r.word + ' ' + k);
  }
  const remoteQueue = [...m.records];
  await Promise.all(Array.from({ length: 4 }, async () => {
    let item; while ((item = remoteQueue.shift())) await checkRemote(item);
  }));
  let preserved = 0;
  for (const file of await fs.readdir('docs')) if (/^senior-word-illustrations-generation-batch\d+\.json$/.test(file) && Number(file.match(/batch(\d+)/)[1]) < Number(suffix)) {
    const previous = await json(path.join('docs', file));
    for (const r of previous.records) { const row = rows.find(x => x.id === r.id); if (!row || row.image_url !== r.image_url || row.example !== r.example || row.example_zh !== r.example_zh) throw Error('Previous content changed: ' + r.word); preserved++; }
  }
  const config = await json(path.join(base, 'senior-import-public-config.json'));
  const closed = await fetch(projectUrl + `/functions/v1/word-illustration-batch-import-senior-${suffix}`, { headers: { Authorization: 'Bearer ' + config.anon }, signal: AbortSignal.timeout(60000) });
  if (closed.status !== 410) throw Error('Importer not closed: ' + closed.status);
  const result = { at: new Date().toISOString(), anonymous_api_verified: m.records.length, word_bank_verified: words.length, remote_sha256_verified: m.records.length, previous_batches_preserved: preserved, total_senior: rows.length, importer_status: closed.status };
  await save(path.join(base, `senior-batch-${suffix}-api-verification.json`), result); console.log(JSON.stringify(result));
} else if (command === 'cleanup') {
  const m = await json(stagedFile), verified = await json(path.join(base, `senior-batch-${suffix}-api-verification.json`)), ui = await json(path.join(qaDir, 'results.json'));
  if (await exists(path.join(base, `senior-batch-${suffix}-import-function/import-token`))) throw Error('Private import token must be removed before cleanup');
  if (verified.anonymous_api_verified !== m.records.length || verified.remote_sha256_verified !== m.records.length || verified.importer_status !== 410 || m.records.some(r => !r.qa_reviewed)) throw Error('Cloud or image review incomplete');
  if (ui.filter(r => r.word).length < Math.min(5, m.records.length) * 3 || ui.some(r => r.errors?.length || r.overflow)) throw Error('UI verification incomplete');
  const remoteQueue = [...m.records];
  await Promise.all(Array.from({ length: 4 }, async () => {
    let item; while ((item = remoteQueue.shift())) await checkRemote(item);
  }));
  const candidates = [];
  for (const r of m.records) {
    for (const [file, expected, root, type] of [[r.source_path, r.source_sha256, sourceRoot, 'sourcePng'], [r.staged_path, r.staged_sha256, outputRoot, 'projectWebp'], [path.resolve('dist/images/vocabulary/senior', path.basename(r.storage_path)), r.staged_sha256, path.resolve('dist/images/vocabulary/senior'), 'buildWebp']]) {
      if (!safeWithin(file, root)) throw Error('Unsafe cleanup target: ' + file);
      if (await exists(file)) { const resolved = await fs.realpath(file); if (!safeWithin(resolved, root)) throw Error('Cleanup target resolves outside allowed root'); const data = await fs.readFile(resolved); if (hash(data) !== expected) throw Error('Cleanup hash changed: ' + file); candidates.push({ path: resolved, bytes: data.length, sha256: expected, type }); }
    }
  }
  for (const name of await fs.readdir(qaDir)) if (/\.png$/i.test(name)) { const file = await fs.realpath(path.join(qaDir, name)); if (!safeWithin(file, qaDir)) throw Error('Unsafe QA path'); const bytes = await fs.readFile(file); candidates.push({ path: file, bytes: bytes.length, sha256: hash(bytes), type: 'qaImages' }); }
  await save(path.join(base, `senior-batch-${suffix}-cleanup-targets.json`), candidates);
  const result = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.resolve('scripts/recycleSeniorWordImages.ps1'), '-ManifestPath', path.join(base, `senior-batch-${suffix}-cleanup-targets.json`)], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error('Recycle operation failed: ' + (result.error?.message || result.stderr));
  const remaining = []; for (const file of candidates) if (await exists(file.path)) remaining.push(file.path);
  if (remaining.length) throw Error('Cleanup left local images: ' + remaining.length);
  const report = { mode: 'recycle_bin', completedAt: new Date().toISOString(), recycledFiles: candidates.length, bytes: candidates.reduce((n, r) => n + r.bytes, 0), remainingAtOriginalPaths: 0 };
  for (const type of ['sourcePng', 'projectWebp', 'buildWebp', 'qaImages']) report[type] = candidates.filter(r => r.type === type).length;
  await save(path.join(base, `senior-batch-${suffix}-cleanup.json`), report);
  for (const r of m.records) { r.local_asset_deleted = true; r.status = 'published_verified'; }
  Object.assign(m, { status: m.records.length === m.planned_target_count ? 'complete' : 'partial_published', completed_at: new Date().toISOString(), publication: 'cloud_published_and_verified', local_cleanup: report, local_assets_retained: false, import_endpoint_closed: true, local_import_token_deleted: true, total_senior_illustrated_words: verified.total_senior, remaining_words_after_batch: 2838 - verified.total_senior, database_verified_count: m.records.length, remote_sha256_verified_count: m.records.length, anonymous_api_verified_count: m.records.length });
  await save(`docs/senior-word-illustrations-generation-batch${suffix}.json`, m); await save(stagedFile, m);
  console.log(JSON.stringify(report));
} else if (command === 'report') {
  const file = `docs/senior-word-illustrations-generation-batch${suffix}.json`, m = await json(file);
  const tests = await fs.readFile(path.join(base, `senior-batch-${suffix}-tests-final.log`), 'utf8');
  const build = await fs.readFile(path.join(base, `senior-batch-${suffix}-build.log`), 'utf8');
  const local = await json(path.join(qaDir, 'results.json')), production = await json(path.join(qaDir, 'production-results.json'));
  const apiResult = await json(path.join(base, `senior-batch-${suffix}-api-verification.json`));
  const passed = Number(tests.match(/Tests\s+(\d+) passed/)?.[1]), files = Number(tests.match(/Test Files\s+(\d+) passed/)?.[1]);
  if (!passed || !files || /\d+ failed/.test(tests) || !build.includes('built in') || !m.local_cleanup || m.local_cleanup.remainingAtOriginalPaths !== 0 || production.length !== 2) throw Error('Final evidence is incomplete');
  m.total_webp_bytes = m.records.reduce((n, r) => n + r.staged_bytes, 0);
  m.verification = { tests: { files, passed }, production_build: 'passed', local_viewports: [1440, 390, 320], local_visual_scenes: local.length, production_checks: production, anonymous_api: apiResult, audio: 'Local TTS stubbed; audio quality not verified.' };
  await save(file, m); await save(sourceFile, m);
  const cleanup = m.local_cleanup, date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());
  const words = [...new Set(local.map(r => r.word))].join('、');
  const md = `# 高中單字圖片與例句：第 ${suffix} 批\n\n${date} 完成 ${m.records[0].word} 到 ${m.records.at(-1).word} 共 ${m.records.length} 字。以內建 image_gen 逐字獨立產生暖色 3D 情境圖，附完整英文例句、繁中翻譯與圖片描述。768 × 768 WebP 合計 ${m.total_webp_bytes.toLocaleString('en-US')} bytes。\n\n## 雲端內容\n\n圖片已上傳 Supabase Storage 的 word-illustrations/senior/，逐張重新下載核對格式、尺寸與 SHA-256。word_illustrations 與 word_bank 詞義、雙語例句完全一致，匿名 API 可讀；先前 ${apiResult.previous_batches_preserved} 字均保留。匯入端點已確認 HTTP 410，臨時憑證已移除。資料更新前比對原值，避免覆蓋並行修改。\n\n[完整提示詞、例句、來源、雜湊與清理紀錄](senior-word-illustrations-generation-batch${suffix}.json)。本地插畫目錄及高中備援字庫已同步。雲端內容供正式網站直接讀取，本批未部署整個工作目錄。\n\n## 驗證與清理\n\n- ${files} 個測試檔、${passed} 項測試通過；正式建置通過。\n- ${words} 在 1440、390、320 px 共 ${local.length} 組畫面通過：實際雲端圖片解碼、雙語字幕、水平溢出與 console/page 錯誤檢查正常。另有 ${production.length} 組正式網站檢查通過。\n- 本地 Vite 的 TTS 使用測試音訊，未驗證發音品質。\n- 驗證後將 ${cleanup.sourcePng} 張原始 PNG、${cleanup.projectWebp} 張專案 WebP、${cleanup.buildWebp} 張建置副本與 ${cleanup.qaImages} 張檢查圖片移至資源回收筒，共 ${cleanup.recycledFiles} 檔、${cleanup.bytes.toLocaleString('en-US')} bytes；原路徑無留存。清空回收筒後才會釋放空間。\n\n## 接續進度\n\n高中已完成 **${apiResult.total_senior}／2,838 字**，尚有 **${2838 - apiResult.total_senior} 字**缺圖。應依最新雲端缺圖清單接續，直至缺圖數為 0。\n`;
  await fs.writeFile(`docs/senior-word-illustrations-batch${suffix}.md`, md);
  console.log(JSON.stringify({ batch: suffix, published: m.records.length, total_senior: apiResult.total_senior, remaining: 2838 - apiResult.total_senior, tests: passed, recycled_files: cleanup.recycledFiles }));
} else throw Error('Unknown command: ' + command);
