// Comunicação em Tempo Real via WebSocket Nativo e Socket.IO
let ws = null;
let reconnectTimer = null;
const socket = (typeof io !== 'undefined') ? io() : null;

// Contador local de preferenciais seguidas (espelha state.prioCounter do servidor)
let localPrioCount = 0;

// Estado local global para espelhar dados do servidor
window.serverState = {
    counters: { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
    queues: { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
    currentCall: null,
    history: []
};

// Notifica as interfaces quando o estado é atualizado
function notifyStateUpdate(state) {
    if (!state) return;
    window.serverState = state;
    if (typeof state.prioCounter === 'number') localPrioCount = state.prioCounter;
    if (typeof updateUI === 'function') updateUI(state);
    if (typeof renderPanel === 'function') renderPanel(state);
}

// Inicializa conexão WebSocket nativa
function initWebSocket() {
    if (typeof window === 'undefined') return;

    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3000';
        const wsUrl = `${protocol}//${host}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Conectado via WebSocket Nativo');
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'stateUpdate' || message.type === 'STATE_UPDATE') {
                    const stateData = message.data || message.payload || message.state;
                    notifyStateUpdate(stateData);
                }
            } catch (err) {
                console.error('Erro ao processar mensagem do WebSocket:', err);
            }
        };

        ws.onclose = () => {
            console.warn('⚠️ Conexão WebSocket perdida. Reconectando em 2 segundos...');
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    initWebSocket();
                }, 2000);
            }
        };

        ws.onerror = (err) => {
            console.error('Erro no WebSocket:', err);
        };
    } catch (e) {
        console.error('Falha ao iniciar WebSocket:', e);
    }
}

// Envia mensagem via WebSocket se conectado
function sendWsMessage(type, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
        return true;
    }
    return false;
}

// Inicia conexão WebSocket
initWebSocket();

// Sincronização via Socket.IO (para compatibilidade adicional se carregado)
if (socket) {
    socket.on('stateUpdate', (state) => {
        notifyStateUpdate(state);
    });
}

// Mapeia o nome do setor para a sigla da senha
function getPrefixByService(service) {
    switch (service) {
        case 'Vara Criminal': return 'CRIM';
        case 'Família': return 'FAM';
        case 'Execução Penal': return 'PEN';
        default: return 'ATD';
    }
}

// Busca estado atual do servidor via API REST (fallback/inicialização)
async function getData() {
    try {
        const res = await fetch('/api/state');
        if (res.ok) {
            const data = await res.json();
            window.serverState = data;
            return data;
        }
    } catch (e) {
        console.warn('Servidor offline ou sem rota /api/state. Usando dados locais.', e);
    }
    return window.serverState;
}

// Gera nova senha com prefixo por setor (CRIM, FAM, PEN)
async function generateTicket(service, category) {
    const prefix = getPrefixByService(service);

    try {
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, category, prefix })
        });
        
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('Erro ao conectar com API REST, tentando via WebSocket / local...', e);
    }

    // Tenta via WebSocket
    if (sendWsMessage('NEW_TICKET', { service, category, prefix })) {
        console.log('Senha solicitada via WebSocket');
    }

    // Fallback Local se o backend não responder
    if (!window.serverState.counters[prefix]) {
        window.serverState.counters[prefix] = 0;
    }
    window.serverState.counters[prefix]++;
    const num = String(window.serverState.counters[prefix]).padStart(3, '0');

    const ticket = {
        code: `${prefix}-${num}`,
        service: service,
        category: category,
        createdAt: new Date().toISOString()
    };

    if (!window.serverState.queues[category]) {
        window.serverState.queues[category] = [];
    }
    window.serverState.queues[category].push(ticket);

    if (socket) socket.emit('newTicket', ticket);

    return ticket;
}

// Função auxiliar para extrair o próximo item de uma fila específica por setor
function popFromQueue(category, serviceFilter) {
    const queue = window.serverState.queues[category] || [];
    const index = queue.findIndex(item => serviceFilter === 'ALL' || item.service === serviceFilter);
    if (index !== -1) {
        return queue.splice(index, 1)[0];
    }
    return null;
}

// Chama o próximo da fila com a mesma regra do servidor (server.js → processCallNext):
// 1. Até 2 preferenciais seguidas; entre elas, Idoso (80+) vem antes de Prioridade Legal.
// 2. Depois disso, 1 Normal (se houver) e o contador volta a zero.
// 3. Sem Normais na fila, continua chamando preferenciais.
// A lógica local abaixo só roda se a API REST não responder.
async function callNextTicket(desk, serviceFilter = 'ALL') {
    try {
        const res = await fetch('/api/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ desk, serviceFilter })
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('Erro na chamada REST, processando localmente...', e);
    }

    const hasItems = (category) => (window.serverState.queues[category] || [])
        .some(item => serviceFilter === 'ALL' || item.service === serviceFilter);
    const popPreferencial = () => popFromQueue(hasItems('IDOSO') ? 'IDOSO' : 'PRIORIDADE', serviceFilter);

    const preferenciaisDisponiveis = hasItems('IDOSO') || hasItems('PRIORIDADE');
    let chosenTicket = null;

    if (localPrioCount < 2 && preferenciaisDisponiveis) {
        chosenTicket = popPreferencial();
        localPrioCount++;
    } else if (hasItems('NORMAL')) {
        chosenTicket = popFromQueue('NORMAL', serviceFilter);
        localPrioCount = 0;
    } else if (preferenciaisDisponiveis) {
        chosenTicket = popPreferencial();
    }

    if (chosenTicket) {
        let formattedDesk = desk ? desk.toString().replace(/\D/g, '') : '';
        formattedDesk = formattedDesk ? formattedDesk.padStart(2, '0') : (desk || '01');

        chosenTicket.desk = formattedDesk;
        chosenTicket.calledAt = new Date().toISOString();

        window.serverState.currentCall = chosenTicket;
        window.serverState.history = (window.serverState.history || []).filter(h => h.code !== chosenTicket.code);
        window.serverState.history.unshift(chosenTicket);

        const svcCounts = {};
        window.serverState.history = window.serverState.history.filter(item => {
            const svc = item.service || 'Geral';
            svcCounts[svc] = (svcCounts[svc] || 0) + 1;
            return svcCounts[svc] <= 5;
        });

        sendWsMessage('CALL_TICKET', { desk, serviceFilter });
        if (socket) socket.emit('callTicket', chosenTicket);
    }

    return chosenTicket;
}

// Rechamada de senha no histórico
async function recallTicket(code, desk) {
    try {
        const res = await fetch('/api/recall', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, desk })
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('Erro na rechamada REST...', e);
    }

    const ticket = window.serverState.history.find(item => item.code === code);
    if (ticket) {
        let formattedDesk = desk ? desk.toString().replace(/\D/g, '') : '';
        formattedDesk = formattedDesk ? formattedDesk.padStart(2, '0') : (desk || '01');

        ticket.desk = formattedDesk;
        ticket.recalledAt = new Date().toISOString();
        window.serverState.currentCall = ticket;

        sendWsMessage('RECALL_TICKET', { code, desk });
        if (socket) socket.emit('callTicket', ticket);
    }
    return ticket;
}

// Zerar filas e contadores
async function resetSystem() {
    try {
        await fetch('/api/reset', { method: 'POST' });
    } catch (e) {
        console.warn('Erro ao resetar sistema via REST...', e);
    }

    localPrioCount = 0;
    window.serverState = {
        counters: { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
        queues: { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
        currentCall: null,
        history: []
    };

    sendWsMessage('RESET_SYSTEM');
    if (socket) socket.emit('resetSystem');
}