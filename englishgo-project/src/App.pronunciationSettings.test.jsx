import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const patchSource = readFileSync(path.join(process.cwd(), 'public', 'elevenlabs-tts-patch.js'), 'utf8');
const openaiSetupNote = 'OpenAI 需由管理者完成金鑰設定後才能使用；尚未啟用時會使用裝置語音。';
let nativeSpeak;

function installSpeechAdapter() {
  delete window.__englishGoElevenLabsTtsPatch;
  nativeSpeak = vi.fn();
  vi.stubGlobal('speechSynthesis', {
    speak: nativeSpeak,
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(text) {
      this.text = text;
      this.lang = 'en-US';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
    }
  });
  window.eval(patchSource);
}

async function openSettingsFromLanding() {
  const view = render(<App />);
  const parentSettings = document.querySelector('.eg-grownup');
  fireEvent.click(parentSettings.querySelector('summary'));
  parentSettings.open = true;
  fireEvent.click(screen.getByRole('button', { name: '設定（朗讀、Gemini／Giphy）' }));
  await screen.findByRole('heading', { name: '設定' });
  return view;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Settings must not make a speech API request'))));
  installSpeechAdapter();
});

afterEach(() => {
  cleanup();
  delete window.EnglishGoTTS;
  delete window.__englishGoElevenLabsTtsPatch;
  document.getElementById('eg-tts-styles')?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pronunciation settings', () => {
  it('opens from the landing page with the original ElevenLabs service selected', async () => {
    await openSettingsFromLanding();

    const provider = screen.getByRole('combobox', { name: '發音服務' });
    expect(provider).toHaveValue('elevenlabs');
    expect(within(provider).getByRole('option', { name: 'ElevenLabs（原本的發音）' }).selected).toBe(true);
    expect(within(provider).getByRole('option', { name: 'OpenAI（需啟用）' })).toBeInTheDocument();
    expect(within(provider).getByRole('option', { name: '裝置語音（免 API）' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '英文朗讀聲音' })).toHaveDisplayValue('清晰美式（推薦） · US');
    expect(screen.queryByText(openaiSetupNote)).not.toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('explains OpenAI activation and remembers the chosen service, voice and speed after reopening', async () => {
    const view = await openSettingsFromLanding();
    fireEvent.change(screen.getByRole('combobox', { name: '發音服務' }), { target: { value: 'openai' } });

    expect(screen.getByText(openaiSetupNote)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '英文朗讀聲音' })).toHaveDisplayValue('清晰自然（推薦）');
    fireEvent.change(screen.getByRole('combobox', { name: '英文朗讀聲音' }), { target: { value: 'cedar' } });
    fireEvent.change(screen.getByRole('slider', { name: '預設朗讀速度' }), { target: { value: '0.85' } });
    view.unmount();

    // Reinstalling the real adapter discards its memory, as a fresh page load would.
    installSpeechAdapter();
    render(<App />);
    await screen.findByRole('heading', { name: '設定' });
    expect(screen.getByRole('combobox', { name: '發音服務' })).toHaveValue('openai');
    expect(screen.getByRole('combobox', { name: '英文朗讀聲音' })).toHaveDisplayValue('溫暖沉穩');
    expect(screen.getByRole('slider', { name: '預設朗讀速度' })).toHaveValue('0.85');
    expect(screen.getByText(openaiSetupNote)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('restores each cloud service’s own voice when switching between providers', async () => {
    await openSettingsFromLanding();
    fireEvent.change(screen.getByRole('combobox', { name: '英文朗讀聲音' }), { target: { value: 'EXAVITQu4vr4xnSDxMaL' } });
    fireEvent.change(screen.getByRole('combobox', { name: '發音服務' }), { target: { value: 'openai' } });
    fireEvent.change(screen.getByRole('combobox', { name: '英文朗讀聲音' }), { target: { value: 'coral' } });

    fireEvent.change(screen.getByRole('combobox', { name: '發音服務' }), { target: { value: 'elevenlabs' } });
    expect(screen.getByRole('combobox', { name: '英文朗讀聲音' })).toHaveDisplayValue('溫暖美式 · US');
    expect(screen.queryByText(openaiSetupNote)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '發音服務' }), { target: { value: 'openai' } });
    expect(screen.getByRole('combobox', { name: '英文朗讀聲音' })).toHaveDisplayValue('明亮親切');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('disables cloud regeneration in device mode and previews through the device', async () => {
    vi.spyOn(window.EnglishGoTTS, 'getLastRegenerableText').mockReturnValue('apple');
    await openSettingsFromLanding();
    expect(screen.getByRole('button', { name: '重產最近發音' })).toBeEnabled();

    fireEvent.change(screen.getByRole('combobox', { name: '發音服務' }), { target: { value: 'device' } });
    expect(screen.getByRole('button', { name: '重產最近發音' })).toBeDisabled();
    expect(screen.getByText('使用這台裝置的內建語音')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '英文朗讀聲音' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '試聽目前設定' }));
    expect(nativeSpeak).toHaveBeenCalledWith(expect.objectContaining({ text: 'You can change the English reading speed here.' }));
    expect(globalThis.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox', { name: '發音服務' }), { target: { value: 'elevenlabs' } });
    expect(screen.getByRole('button', { name: '重產最近發音' })).toBeEnabled();
  });
});
