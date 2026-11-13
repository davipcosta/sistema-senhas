const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const googleTTS = require('google-tts-api');

const app = express();
const server = http.createServer(app);

// Inicializa WebSocket Server nativo (ws)
const wss = new WebSocketServer({ noServer: true });

// Inicializa Socket.IO
const io = new Server(server, { cors: { origin: '*' } });

// Delega o upgrade HTTP
server.on('upgrade', (request, socket, head) => {
    try {
        const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        if (url.pathname.startsWith('/socket.io')) {
            return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } catch (err) {
        socket.destroy();
    }
});

// Diretório de cache para áudios TTS
const AUDIO_CACHE_DIR = path.join(__dirname, 'audio_cache');
if (!fs.existsSync(AUDIO_CACHE_DIR)) {
    fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(__dirname));

// Diretório de dados persistidos (JSON)
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadPersistedState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, 'utf-8');
            const data = JSON.parse(raw);
            console.log('[Persistência] Estado recuperado com sucesso de data/state.json');
            return {
                queues: data.queues || { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
                counters: data.counters || { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
                prioCounter: data.prioCounter || 0,
                currentCall: data.currentCall || null,
                history: data.history || []
            };
        }
    } catch (err) {
        console.error('[Persistência] Falha ao ler arquivo de estado:', err);
    }
    return {
        queues: { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
        counters: { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
        prioCounter: 0,
        currentCall: null,
        history: []
    };
}

let state = loadPersistedState();

function saveStateToFile() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
        console.error('[Persistência] Erro ao salvar estado:', err);
    }
}

// ⏱️ Controle de Cooldown Por Setor (8 segundos)
const CALL_INTERVAL_MS = 8000;
const lastCallByService = {}; // Ex: { 'Vara Criminal': 1710000000, 'Família': 1710000005 }
const callQueueByService = {};

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Aplica delay isolado por setor
async function withCallDelayByService(serviceKey, action) {
    if (!callQueueByService[serviceKey]) {
        callQueueByService[serviceKey] = Promise.resolve();
    }

    const previous = callQueueByService[serviceKey];
    let release;
    callQueueByService[serviceKey] = new Promise(resolve => {
        release = resolve;
    });

    await previous;

    const lastCall = lastCallByService[serviceKey] || 0;
    const elapsed = Date.now() - lastCall;
    if (elapsed < CALL_INTERVAL_MS) {
        await wait(CALL_INTERVAL_MS - elapsed);
    }

    try {
        return await action();
    } finally {
        lastCallByService[serviceKey] = Date.now();
        release();
    }
}

function broadcastState() {
    const payload = JSON.stringify({ type: 'stateUpdate', data: state });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(payload);
            } catch (err) {
                console.error('Erro ao enviar mensagem WebSocket:', err);
            }
        }
    });

    io.emit('stateUpdate', state);
    saveStateToFile();
}

function createTicket({ service, category, prefix = 'ATD' }) {
    if (!state.counters[prefix]) {
        state.counters[prefix] = 0;
    }
    state.counters[prefix]++;

    const numSeq = String(state.counters[prefix]).padStart(3, '0');
    const ticketCode = `${prefix}-${numSeq}`;

    const ticket = {
        code: ticketCode,
        category,
        service,
        createdAt: new Date().toISOString()
    };

    if (!state.queues[category]) {
        state.queues[category] = [];
    }

    state.queues[category].push(ticket);
    broadcastState();
    return ticket;
}

// Chamada respeitando o cooldown individual por setor
async function processCallNext(desk, serviceFilter = 'ALL') {
    const serviceKey = serviceFilter || 'ALL';

    return await withCallDelayByService(serviceKey, async () => {
        let selectedCategory = null;

        const hasCategoryItems = (cat) => {
            const list = state.queues[cat] || [];
            return list.some(item => serviceFilter === 'ALL' || item.service === serviceFilter);
        };

        const preferenciaisDisponiveis = hasCategoryItems('IDOSO') || hasCategoryItems('PRIORIDADE');
        const normaisDisponiveis = hasCategoryItems('NORMAL');

        if (state.prioCounter < 2 && preferenciaisDisponiveis) {
            selectedCategory = hasCategoryItems('IDOSO') ? 'IDOSO' : 'PRIORIDADE';
            state.prioCounter++;
        } else if (normaisDisponiveis) {
            selectedCategory = 'NORMAL';
            state.prioCounter = 0;
        } else if (preferenciaisDisponiveis) {
            selectedCategory = hasCategoryItems('IDOSO') ? 'IDOSO' : 'PRIORIDADE';
        }

        if (!selectedCategory) {
            const error = new Error('Nenhuma senha na fila para este filtro.');
            error.statusCode = 404;
            throw error;
        }

        const index = state.queues[selectedCategory].findIndex(
            item => serviceFilter === 'ALL' || item.service === serviceFilter
        );

        if (index === -1) {
            const error = new Error('Nenhuma senha para esse serviço.');
            error.statusCode = 404;
            throw error;
        }

        const selectedTicket = state.queues[selectedCategory].splice(index, 1)[0];

        let formattedDesk = desk ? desk.toString().replace(/\D/g, '') : '';
        formattedDesk = formattedDesk ? formattedDesk.padStart(2, '0') : (desk || '01');

        const result = {
            ...selectedTicket,
            desk: formattedDesk,
            calledAt: new Date().toISOString()
        };

        state.currentCall = result;
        state.history = state.history.filter(h => h.code !== result.code);
        state.history.unshift(result);
        
        const serviceCounts = {};
        state.history = state.history.filter(item => {
            const svc = item.service || 'Geral';
            serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
            return serviceCounts[svc] <= 5;
        });

        broadcastState();
        return result;
    });
}

async function processRecall(code, desk) {
    const targetTicket = state.history.find(h => h.code === code);
    const serviceKey = targetTicket ? (targetTicket.service || 'ALL') : 'ALL';

    return await withCallDelayByService(serviceKey, async () => {
        const ticket = state.history.find(h => h.code === code);
        if (!ticket) {
            const error = new Error('Senha não encontrada.');
            error.statusCode = 404;
            throw error;
        }

        let formattedDesk = desk ? desk.toString().replace(/\D/g, '') : '';
        formattedDesk = formattedDesk ? formattedDesk.padStart(2, '0') : (desk || '01');

        const result = {
            ...ticket,
            desk: formattedDesk,
            recalledAt: new Date().toISOString()
        };

        state.currentCall = result;
        state.history = state.history.filter(h => h.code !== code);
        state.history.unshift(result);

        const recallServiceCounts = {};
        state.history = state.history.filter(item => {
            const svc = item.service || 'Geral';
            recallServiceCounts[svc] = (recallServiceCounts[svc] || 0) + 1;
            return recallServiceCounts[svc] <= 5;
        });

        broadcastState();
        return result;
    });
}

function resetState() {
    state = {
        queues: { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
        counters: { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
        prioCounter: 0,
        currentCall: null,
        history: []
    };
    
    // Limpa o mapa de cooldowns ao resetar
    Object.keys(lastCallByService).forEach(key => delete lastCallByService[key]);
    
    broadcastState();
    return { message: 'Sistema zerado com sucesso!' };
}

// Endpoint de Voz TTS Padronizada
app.get('/api/tts', async (req, res) => {
    try {
        const text = (req.query.text || '').trim();
        if (!text) return res.status(400).send('Texto não fornecido');

        const hash = crypto.createHash('md5').update(text).digest('hex');
        const filePath = path.join(AUDIO_CACHE_DIR, `${hash}.mp3`);

        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'audio/mpeg');
            return res.sendFile(filePath);
        }

        const base64 = await googleTTS.getAudioBase64(text, {
            lang: 'pt',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000
        });

        const buffer = Buffer.from(base64, 'base64');
        await fs.promises.writeFile(filePath, buffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(buffer);
    } catch (error) {
        console.error('Erro ao gerar TTS:', error.message || error);
        res.status(500).json({ error: 'Erro ao sintetizar áudio.' });
    }
});

// Endpoint de Estado
app.get('/api/state', (req, res) => res.json(state));

// Gerar Senha
app.post('/api/tickets', (req, res) => {
    const { service, category, prefix = 'ATD' } = req.body;
    const ticket = createTicket({ service, category, prefix });
    res.json(ticket);
});

// Chamar Próximo
app.post('/api/call', async (req, res) => {
    try {
        const { desk, serviceFilter = 'ALL' } = req.body;
        const callInfo = await processCallNext(desk, serviceFilter);
        return res.json(callInfo);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message || 'Erro ao chamar próximo.' });
    }
});

// Rechamar
app.post('/api/recall', async (req, res) => {
    try {
        const { code, desk } = req.body;
        const callInfo = await processRecall(code, desk);
        return res.json(callInfo);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message || 'Erro ao rechamar.' });
    }
});

// Zerar
app.post('/api/reset', (req, res) => {
    res.json(resetState());
});

// WebSockets
wss.on('connection', (ws, req) => {
    ws.send(JSON.stringify({ type: 'stateUpdate', data: state }));

    ws.on('message', async (messageData) => {
        try {
            const message = JSON.parse(messageData.toString());
            const actionType = message.type || message.action;

            switch (actionType) {
                case 'GET_STATE':
                case 'getState':
                    ws.send(JSON.stringify({ type: 'stateUpdate', data: state }));
                    break;

                case 'NEW_TICKET':
                case 'newTicket': {
                    const payload = message.payload || message.data || message;
                    const ticket = createTicket({
                        service: payload.service,
                        category: payload.category,
                        prefix: payload.prefix || 'ATD'
                    });
                    ws.send(JSON.stringify({ type: 'ticketCreated', data: ticket }));
                    break;
                }

                case 'CALL_TICKET':
                case 'callTicket': {
                    const payload = message.payload || message.data || message;
                    try {
                        const callInfo = await processCallNext(payload.desk, payload.serviceFilter || 'ALL');
                        ws.send(JSON.stringify({ type: 'ticketCalled', data: callInfo }));
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', error: err.message }));
                    }
                    break;
                }

                case 'RECALL_TICKET':
                case 'recallTicket': {
                    const payload = message.payload || message.data || message;
                    try {
                        const callInfo = await processRecall(payload.code, payload.desk);
                        ws.send(JSON.stringify({ type: 'ticketRecalled', data: callInfo }));
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', error: err.message }));
                    }
                    break;
                }

                case 'RESET_SYSTEM':
                case 'resetSystem':
                    resetState();
                    ws.send(JSON.stringify({ type: 'systemReset', data: { success: true } }));
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;

                default:
                    broadcastState();
            }
        } catch (err) {
            console.error('[WebSocket] Erro ao processar mensagem:', err);
        }
    });
});

io.on('connection', (socket) => {
    socket.emit('stateUpdate', state);
    socket.on('newTicket', () => broadcastState());
    socket.on('callTicket', () => broadcastState());
    socket.on('resetSystem', () => broadcastState());
});

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        if (name.includes('docker') || name.includes('br-') || name.includes('veth') || name.includes('lo')) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

app.get('/api/info', (req, res) => {
    const localIp = getLocalIp();
    const port = process.env.PORT || 3000;
    res.json({ ip: localIp, port: port, networkUrl: `http://${localIp}:${port}` });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor] DPE-PA rodando na porta ${PORT}`);
    console.log(`[Acesso Rede] http://${getLocalIp()}:${PORT}`);
});