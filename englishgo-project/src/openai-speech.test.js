import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ sockets: [], constructorError: false }));
vi.mock("ws", async () => {
  const { EventEmitter } = await import("node:events");
  return { default: class FakeSocket extends EventEmitter {
    static CLOSED = 3;
    constructor(url, options) {
      super();
      if (transport.constructorError) throw new Error("provider internal credential detail");
      this.url = url;
      this.options = options;
      this.readyState = 1;
      this.sent = [];
      this.terminate = vi.fn(() => { this.readyState = 3; this.emit("close"); });
      transport.sockets.push(this);
    }
    send(data) { this.sent.push(JSON.parse(data)); }
  } };
});

import { OPENAI_SPEECH_MODEL, OPENAI_SPEECH_PROMPT_REVISION, synthesizeSpeech } from "../netlify/lib/openai-speech.mjs";

const input = { apiKey: "test-api-key", text: "Hello, world!" };
const pcm = Buffer.from([0, 0, 1, 0, 255, 127, 0, 128]);
const emit = (socket, event) => socket.emit("message", Buffer.from(JSON.stringify(event)));
function connect(socket = transport.sockets.at(-1)) {
  emit(socket, { type: "session.created" });
  emit(socket, { type: "session.updated" });
  emit(socket, { type: "response.created", response: { id: "response-1" } });
  return socket;
}
function audio(socket, bytes = pcm) {
  emit(socket, { type: "response.output_audio.delta", response_id: "response-1", delta: bytes.toString("base64") });
}
function complete(socket, transcript = input.text, status = "completed") {
  emit(socket, { type: "response.output_audio_transcript.done", response_id: "response-1", transcript, output_index: 0, content_index: 0 });
  emit(socket, { type: "response.done", response: { id: "response-1", status } });
}

describe("OpenAI pronunciation synthesis", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    transport.sockets.length = 0;
    transport.constructorError = false;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends text through Realtime and returns an intact PCM WAV after verified completion", async () => {
    const result = synthesizeSpeech({ ...input, voice: "cedar", speed: 0.85 });
    const socket = transport.sockets[0];
    expect(socket.url).toBe(`wss://api.openai.com/v1/realtime?model=${OPENAI_SPEECH_MODEL}`);
    expect(OPENAI_SPEECH_PROMPT_REVISION).toBeTruthy();
    expect(socket.options.headers.Authorization).toBe("Bearer test-api-key");
    expect(socket.sent).toEqual([]);
    emit(socket, { type: "session.created" });
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({
      type: "session.update", session: { type: "realtime", output_modalities: ["audio"], audio: {
        input: { turn_detection: null }, output: { format: { type: "audio/pcm", rate: 24000 }, voice: "cedar", speed: 0.85 }
      } }
    });
    emit(socket, { type: "session.updated" });
    expect(socket.sent[1]).toMatchObject({ type: "conversation.item.create", item: { role: "user", content: [{ type: "input_text", text: input.text }] } });
    expect(socket.sent[2]).toMatchObject({ type: "response.create", response: { output_modalities: ["audio"] } });
    emit(socket, { type: "response.created", response: { id: "response-1" } });
    audio(socket, pcm.subarray(0, 3));
    audio(socket, pcm.subarray(3));
    complete(socket, "HELLO WORLD.");
    const wav = await result;
    expect(Buffer.isBuffer(wav)).toBe(true);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 16)).toBe("WAVEfmt ");
    expect(wav.readUInt32LE(4)).toBe(pcm.length + 36);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(28)).toBe(48000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
    expect(socket.terminate).toHaveBeenCalledOnce();
    expect(socket.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["I'm packing 3 apples.", "I am packing three apples."],
    ["We can't buy 21 tickets.", "We cannot buy twenty-one tickets."],
    ["You'll find 1000 stars.", "You will find one thousand stars."],
    ["U.S. students don't wait.", "US students do not wait."]
  ])("accepts conventional transcript spelling: %s", async (text, transcript) => {
    const result = synthesizeSpeech({ ...input, text });
    const socket = connect();
    audio(socket);
    complete(socket, transcript);
    await expect(result).resolves.toBeInstanceOf(Buffer);
  });

  it("preserves Chinese readback and ignores punctuation and inter-character spacing", async () => {
    const result = synthesizeSpeech({ ...input, text: "你好，世界！", lang: "zh-TW" });
    const socket = connect();
    expect(socket.sent[0].session.instructions).toContain("Taiwan Mandarin");
    audio(socket);
    complete(socket, "你 好 世 界。");
    await expect(result).resolves.toBeInstanceOf(Buffer);
  });

  it.each(["Sure! Hello world!", "Hello, moon!", ""]) ("rejects unasked or missing words: %s", async (transcript) => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_mismatch", status: 502 });
    const socket = connect();
    audio(socket);
    complete(socket, transcript);
    await rejected;
    expect(socket.terminate).toHaveBeenCalledOnce();
  });

  it("rejects different numbers even though spelling may vary", async () => {
    const result = synthesizeSpeech({ ...input, text: "I have 3 apples." });
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_mismatch" });
    const socket = connect();
    audio(socket);
    complete(socket, "I have four apples.");
    await rejected;
  });

  it.each(["failed", "incomplete", "cancelled"])("does not return partial audio for %s responses", async (status) => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_incomplete" });
    const socket = connect();
    audio(socket);
    complete(socket, input.text, status);
    await rejected;
  });

  it("sanitizes provider errors and handles rate limits", async () => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_rate_limited", status: 429, message: "Pronunciation audio is temporarily unavailable." });
    const socket = connect();
    emit(socket, { type: "error", error: { code: "rate_limit_exceeded", message: "secret provider detail" } });
    await rejected;
    expect(socket.eventNames()).toEqual([]);
  });

  it("sanitizes constructor and transport failures", async () => {
    transport.constructorError = true;
    await expect(synthesizeSpeech(input)).rejects.toMatchObject({ code: "speech_unavailable", status: 503 });
    expect(vi.getTimerCount()).toBe(0);
    transport.constructorError = false;
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_unavailable", message: "Pronunciation audio is temporarily unavailable." });
    transport.sockets[0].emit("error", new Error("private handshake detail"));
    await rejected;
  });

  it("rejects an early connection close", async () => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_incomplete" });
    connect().emit("close");
    await rejected;
  });

  it("terminates the handshake on a rejected upgrade", async () => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_unavailable", status: 503 });
    const request = { destroy: vi.fn() };
    const response = { statusCode: 401, resume: vi.fn() };
    transport.sockets[0].emit("unexpected-response", request, response);
    await rejected;
    expect(request.destroy).toHaveBeenCalledOnce();
    expect(response.resume).toHaveBeenCalledOnce();
  });

  it("stops after 25 seconds and clears request listeners", async () => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_timeout", status: 504 });
    const socket = connect();
    await vi.advanceTimersByTimeAsync(25_000);
    await rejected;
    expect(socket.terminate).toHaveBeenCalledOnce();
    expect(socket.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not connect for a pre-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(synthesizeSpeech({ ...input, signal: controller.signal })).rejects.toMatchObject({ code: "speech_aborted", status: 499 });
    expect(transport.sockets).toHaveLength(0);
  });

  it("cancels active generation and removes the abort listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = synthesizeSpeech({ ...input, signal: controller.signal });
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_aborted", status: 499 });
    const socket = connect();
    audio(socket);
    controller.abort();
    await rejected;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(socket.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([Buffer.alloc(0), Buffer.from([0])])("rejects empty or non-PCM16 audio", async (bytes) => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_invalid_audio" });
    const socket = connect();
    audio(socket, bytes);
    complete(socket);
    await rejected;
  });

  it("enforces the four-megabyte aggregate audio limit", async () => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_too_large" });
    const socket = connect();
    const chunk = Buffer.alloc(1024 * 1024);
    for (let i = 0; i < 4; i++) audio(socket, chunk);
    audio(socket, pcm);
    await rejected;
    expect(socket.terminate).toHaveBeenCalledOnce();
  });

  it("rejects malformed protocol data without leaking it", async () => {
    const result = synthesizeSpeech(input);
    const rejected = expect(result).rejects.toMatchObject({ code: "speech_invalid_response" });
    transport.sockets[0].emit("message", Buffer.from("provider internal failure"));
    await rejected;
  });

  it("rejects unsupported voices and invalid input before opening a socket", async () => {
    for (const options of [{ voice: "unknown" }, { text: "" }, { text: "!" }, { speed: 2 }, { text: "a".repeat(901) }]) {
      await expect(synthesizeSpeech({ ...input, ...options })).rejects.toMatchObject({ code: "speech_invalid_input", status: 400 });
    }
    expect(transport.sockets).toHaveLength(0);
  });
});
