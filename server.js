// Ponto de entrada: sobe o Next (telas + API) e o tempo real (WebSocket / Socket.IO)
// no mesmo servidor HTTP.
//   npm run dev  → node server.js --dev
//   npm start    → node server.js        (requer `npm run build` antes)
const dev = process.argv.includes('--dev');
process.env.NODE_ENV = process.env.NODE_ENV || (dev ? 'development' : 'production');

const http = require('http');
const next = require('next');
const { PORT } = require('./lib/server/config');
const { attachRealtime } = require('./lib/server/realtime');
const { getLocalIp } = require('./lib/server/network');

const app = next({ dev, dir: __dirname });

app.prepare().then(() => {
    const handle = app.getRequestHandler();
    const server = http.createServer((req, res) => handle(req, res));

    // O Next registra sozinho o listener de upgrade dele (HMR) na primeira requisição
    attachRealtime(server);

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[Servidor] DPE-PA rodando na porta ${PORT}${dev ? ' (dev)' : ''}`);
        console.log(`[Acesso Rede] http://${getLocalIp()}:${PORT}`);
    });
}).catch((err) => {
    console.error('[Servidor] Falha ao iniciar o Next:', err);
    process.exit(1);
});
