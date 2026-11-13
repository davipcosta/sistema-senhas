// Ponto de entrada: sobe o servidor HTTP com as telas, a API e o tempo real
const express = require('express');
const http = require('http');
const { PORT, PUBLIC_DIR } = require('./config');
const routes = require('./routes');
const { attachRealtime } = require('./realtime');
const { getLocalIp } = require('./network');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/api', routes);

const server = http.createServer(app);
attachRealtime(server);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor] DPE-PA rodando na porta ${PORT}`);
    console.log(`[Acesso Rede] http://${getLocalIp()}:${PORT}`);
});
