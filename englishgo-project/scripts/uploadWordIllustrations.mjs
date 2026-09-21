// One-time import session is provisioned through the Supabase admin connector.
// The endpoint accepts only the approved image hashes and expires after 30 minutes.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const config = JSON.parse(await fs.readFile('.superpowers/word-art/upload-session.json', 'utf8'));
if (!config.token || Date.now() > config.expires) throw new Error('The private import session is closed. Provision a new authorized session before importing another batch.');
const rows = JSON.parse(await fs.readFile('src/data/wordIllustrations.json', 'utf8'));
const report = [];
for (const row of rows) {
  const path = 'elementary/' + row.local_path.split('/').pop();
  const body = await fs.readFile('public' + row.local_path);
  const result = await fetch(config.url + '/functions/v1/word-illustration-import?path=' + encodeURIComponent(path), {
    method: 'POST', headers: { Authorization: 'Bearer ' + config.anon, apikey: config.anon, 'x-import-token': config.token, 'Content-Type': 'image/webp' }, body,
  });
  if (!result.ok) throw new Error('Upload failed for ' + path + ': ' + result.status + ' ' + await result.text());
  const image_url = config.url + '/storage/v1/object/public/word-illustrations/' + path;
  const downloaded = await fetch(image_url);
  if (!downloaded.ok || !downloaded.headers.get('content-type')?.includes('image/webp')) throw new Error('Image is not publicly readable: ' + path);
  const sha256 = createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex');
  if (sha256 !== config.files[path]) throw new Error('Stored image does not match: ' + path);
  report.push({ id: row.id, image_url, sha256, bytes: body.length });
  console.log(row.id + ': uploaded and verified');
}
await fs.writeFile('.superpowers/word-art/upload-report.json', JSON.stringify(report, null, 2));
