import { Readable } from 'node:stream';
import { loadEnv } from 'vite';

// Keep the provider key in Vite's Node process; never expose it through `define`.
export default function localSpeechPlugin() {
  return {
    name: 'englishgo-local-speech',
    apply: 'serve',
    async configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, ['OPENAI_API_KEY', 'SUPABASE_', 'VITE_SUPABASE_URL', 'ELEVENLABS_', 'TTS_']);
      for (const [name, value] of Object.entries(env)) {
        if (!process.env[name] && value) process.env[name] = value;
      }
      const [{ default: openai }, { default: elevenlabs }] = await Promise.all([
        import('../netlify/functions/openai-tts.mjs'),
        import('../netlify/functions/elevenlabs-tts.js'),
      ]);
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const handler = url.pathname === '/.netlify/functions/openai-tts' ? openai
          : url.pathname === '/.netlify/functions/elevenlabs-tts' ? elevenlabs : null;
        if (!handler) return next();
        const controller = new AbortController();
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try {
          const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            signal: controller.signal,
            ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
          });
          const response = await handler(request);
          if (res.destroyed) return;
          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          if (res.destroyed) return;
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Speech service unavailable' }));
        }
      });
    },
  };
}
