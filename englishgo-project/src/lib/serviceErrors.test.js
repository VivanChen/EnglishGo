import { afterEach, expect, it, vi } from 'vitest';
import { assertServiceResponse, responseError, serviceErrorMessage, serviceFetch } from './serviceErrors.js';
import { generateStoryPayload } from '../features/storyGeneration.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([[429,'limited'],[401,'auth'],[403,'auth'],[404,'model'],[400,'request'],[503,'unavailable']])('classifies HTTP %s without leaking provider diagnostics', (status, kind) => {
  const error = responseError({status}, {error:{message:'secret-api-key-or-private-content'}});
  expect(error.kind).toBe(kind);
  expect(serviceErrorMessage(error)).not.toMatch(/secret|private/);
  if (status===429) {
    expect(serviceErrorMessage(error)).toContain('可能是呼叫太頻繁或額度不足');
    expect(serviceErrorMessage(error)).not.toContain('免費額度已用完');
  }
});

it('distinguishes invalid keys from other bad requests', () => {
  expect(responseError({status:400},{error:{message:'API key not valid'}}).kind).toBe('auth');
  expect(responseError({status:400},{error:{message:'invalid schema'}}).kind).toBe('request');
});

it('recognizes a provider error even when the HTTP response is successful', () => {
  expect(()=>assertServiceResponse({ok:true,status:200},{error:{code:429}})).toThrow('limited');
});

it('bounds a stalled body and clears its timer', async () => {
  vi.useFakeTimers();
  const pending=expect(serviceFetch('/test',{},async()=>({ok:true,json:()=>new Promise(()=>{})}),50)).rejects.toMatchObject({kind:'timeout'});
  await vi.advanceTimersByTimeAsync(50);await pending;
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels an already-aborted request without fetching', async () => {
  const controller=new AbortController();controller.abort();const fetchImpl=vi.fn();
  await expect(serviceFetch('/test',{signal:controller.signal},fetchImpl)).rejects.toMatchObject({name:'AbortError'});
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('stops a story quota error immediately instead of issuing six requests', async () => {
  const fetchImpl=vi.fn().mockResolvedValue({ok:false,status:429,json:async()=>({})});
  await expect(generateStoryPayload({apiKey:'test',prompt:'test',pageCount:4,fetchImpl})).rejects.toMatchObject({kind:'limited'});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
