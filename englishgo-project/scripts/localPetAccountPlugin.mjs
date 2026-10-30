import { Readable } from 'node:stream';
import { loadEnv } from 'vite';

export default function localPetAccountPlugin() {
  return {
    name: 'englishgo-local-pet-account',
    apply: 'serve',
    async configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, ['SUPABASE_', 'VITE_SUPABASE_URL']);
      for (const [name, value] of Object.entries(env)) if (!process.env[name] && value) process.env[name] = value;
      const { default: handler } = await import('../netlify/functions/pet-account.mjs');
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (url.pathname !== '/.netlify/functions/pet-account') return next();
        try {
          const response = await handler(new Request(url, { method: req.method, headers: req.headers, ...(!['GET','HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) }));
          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 503; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'unavailable', error: '雲端暫時無法連線，進度會保存在本機。' }));
        }
      });
    },
  };
}
