import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generatePetSounds } from './generatePetSounds.mjs';

const directories=[];
afterEach(async()=>{for(const dir of directories.splice(0)){for(const file of await readdir(dir))await unlink(join(dir,file));await rmdir(dir);}});
async function harness() {
  const dir=await mkdtemp(join(tmpdir(),'englishgo-audio-'));directories.push(dir);
  const output=pathToFileURL(dir+'/'), bytes=Buffer.alloc(256);bytes.write('ID3');
  const fetchImpl=vi.fn(async()=>new Response(bytes,{headers:{'content-type':'audio/mpeg'}}));
  return {output,fetchImpl,log:()=>{}};
}
it('generates one stored instrumental track and ten effects; reruns make zero paid calls',async()=>{
  const options=await harness(), first=await generatePetSounds('test-only',options);
  expect(options.fetchImpl).toHaveBeenCalledTimes(11);
  const [url,request]=options.fetchImpl.mock.calls[10];
  expect(url).toContain('/v1/music?');expect(JSON.parse(request.body)).toMatchObject({force_instrumental:true,music_length_ms:48000,model_id:'music_v2_5'});
  expect(Object.keys(first.files)).toHaveLength(10);expect(first.music.file).toMatch(/^bgm-[a-f0-9]{12}\.mp3$/);
  options.fetchImpl.mockClear();
  expect((await generatePetSounds('test-only',options)).assets).toEqual(first.assets);
  expect(options.fetchImpl).not.toHaveBeenCalled();
});
it('preserves the live manifest on failure and resumes without regenerating successful effects',async()=>{
  const options=await harness(), manifest=new URL('manifest.json',options.output);
  await writeFile(manifest,'existing pack');
  const success=options.fetchImpl.getMockImplementation();
  options.fetchImpl.mockImplementation(async(url,...args)=>url.includes('/music?')?new Response('',{status:403}):success(url,...args));
  await expect(generatePetSounds('test-only',options)).rejects.toThrow('HTTP 403');
  expect(await readFile(manifest,'utf8')).toBe('existing pack');
  options.fetchImpl.mockClear().mockImplementation(success);
  await generatePetSounds('test-only',options);expect(options.fetchImpl).toHaveBeenCalledTimes(1);
});
it('rejects invalid payloads and corrupted caches without publishing or automatic paid retries',async()=>{
  const options=await harness(), success=options.fetchImpl.getMockImplementation();
  options.fetchImpl.mockResolvedValue(new Response('not audio'.repeat(50),{headers:{'content-type':'audio/mpeg'}}));
  await expect(generatePetSounds('test-only',options)).rejects.toThrow('Invalid audio');
  expect(options.fetchImpl).toHaveBeenCalledTimes(1);
  await expect(readFile(new URL('manifest.json',options.output))).rejects.toMatchObject({code:'ENOENT'});
  options.fetchImpl.mockImplementation(success);const manifest=await generatePetSounds('test-only',options);
  await writeFile(new URL(manifest.files.step,options.output),'corrupted');options.fetchImpl.mockClear();
  await expect(generatePetSounds('test-only',options)).rejects.toThrow('integrity checks');expect(options.fetchImpl).not.toHaveBeenCalled();
});
it('rejects concurrent generation before spending any credits',async()=>{
  const options=await harness();await writeFile(new URL('.generation.lock',options.output),'busy');
  await expect(generatePetSounds('test-only',options)).rejects.toThrow('Another generation');expect(options.fetchImpl).not.toHaveBeenCalled();
});
