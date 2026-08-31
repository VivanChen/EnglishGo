import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../netlify/functions/cleanup-old-novel-zh-audio.js";

const ENV_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_TTS_BUCKET"];
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] == null) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

function request(confirm = "") {
  return new Request(`http://localhost/.netlify/functions/cleanup-old-novel-zh-audio?confirm=${encodeURIComponent(confirm)}`, {
    method: "DELETE",
  });
}

describe("old novel Chinese audio cleanup", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.VITE_SUPABASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  it("rejects cleanup without the exact narrow confirmation", async () => {
    globalThis.fetch = vi.fn();

    const response = await handler(request("wrong"));

    expect(response.status).toBe(403);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("deletes only mp3 files below the retired Chinese voice prefix", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: "1", name: "first.mp3" },
        { id: "2", name: "second.mp3" },
        { id: null, name: "nested" },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ name: "first.mp3" }, { name: "second.mp3" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const response = await handler(request("delete-r6qgCCGI7RWKXCagm158-novel-zh-cache"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: 2, remaining: 0, oldVoiceId: "r6qgCCGI7RWKXCagm158" });
    const [, deleteInit] = globalThis.fetch.mock.calls[1];
    expect(JSON.parse(deleteInit.body)).toEqual({
      prefixes: [
        "r6qgCCGI7RWKXCagm158/first.mp3",
        "r6qgCCGI7RWKXCagm158/second.mp3",
      ],
    });
  });
});
