// Regras de negócio: emissão, chamada, rechamada e reset das senhas
const { state, resetState, commit, store } = require('./state');
const { CALL_INTERVAL_MS, HISTORY_PER_SERVICE } = require('./config');

// ⏱️ Controle de intervalo entre chamadas, isolado por setor
// Ex.: { 'Vara Criminal': 1710000000, 'Família': 1710000005 }
const { lastCallByService, callQueueByService } = store;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Executa as chamadas de um setor em fila, respeitando CALL_INTERVAL_MS
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

function notFound(message) {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
}

// "1" → "01"; mantém o valor original se não tiver dígitos
function formatDesk(desk) {
    const digits = desk ? desk.toString().replace(/\D/g, '') : '';
    return digits ? digits.padStart(2, '0') : (desk || '01');
}

// Coloca a chamada no topo do histórico e mantém só as últimas N por setor
function pushToHistory(call) {
    state.history = state.history.filter(h => h.code !== call.code);
    state.history.unshift(call);

    const serviceCounts = {};
    state.history = state.history.filter(item => {
        const svc = item.service || 'Geral';
        serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
        return serviceCounts[svc] <= HISTORY_PER_SERVICE;
    });
}

function createTicket({ service, category, prefix = 'ATD' }) {
    if (!state.counters[prefix]) {
        state.counters[prefix] = 0;
    }
    state.counters[prefix]++;

    const numSeq = String(state.counters[prefix]).padStart(3, '0');
    const ticket = {
        code: `${prefix}-${numSeq}`,
        category,
        service,
        createdAt: new Date().toISOString()
    };

    if (!state.queues[category]) {
        state.queues[category] = [];
    }

    state.queues[category].push(ticket);
    commit();
    return ticket;
}

// Regra: até 2 preferenciais seguidas (Idoso antes de Prioridade), depois 1 Normal.
// Se uma das filas estiver vazia, chama da outra para não travar o guichê.
async function callNext(desk, serviceFilter = 'ALL') {
    const serviceKey = serviceFilter || 'ALL';

    return await withCallDelayByService(serviceKey, async () => {
        const hasCategoryItems = (cat) => {
            const list = state.queues[cat] || [];
            return list.some(item => serviceFilter === 'ALL' || item.service === serviceFilter);
        };
        const preferencial = () => (hasCategoryItems('IDOSO') ? 'IDOSO' : 'PRIORIDADE');

        const preferenciaisDisponiveis = hasCategoryItems('IDOSO') || hasCategoryItems('PRIORIDADE');
        const normaisDisponiveis = hasCategoryItems('NORMAL');

        let selectedCategory = null;
        if (state.prioCounter < 2 && preferenciaisDisponiveis) {
            selectedCategory = preferencial();
            state.prioCounter++;
        } else if (normaisDisponiveis) {
            selectedCategory = 'NORMAL';
            state.prioCounter = 0;
        } else if (preferenciaisDisponiveis) {
            selectedCategory = preferencial();
        }

        if (!selectedCategory) {
            throw notFound('Nenhuma senha na fila para este filtro.');
        }

        const index = state.queues[selectedCategory].findIndex(
            item => serviceFilter === 'ALL' || item.service === serviceFilter
        );
        if (index === -1) {
            throw notFound('Nenhuma senha para esse serviço.');
        }

        const selectedTicket = state.queues[selectedCategory].splice(index, 1)[0];
        const result = {
            ...selectedTicket,
            desk: formatDesk(desk),
            calledAt: new Date().toISOString()
        };

        state.currentCall = result;
        pushToHistory(result);
        commit();
        return result;
    });
}

async function recall(code, desk) {
    const targetTicket = state.history.find(h => h.code === code);
    const serviceKey = targetTicket ? (targetTicket.service || 'ALL') : 'ALL';

    return await withCallDelayByService(serviceKey, async () => {
        const ticket = state.history.find(h => h.code === code);
        if (!ticket) {
            throw notFound('Senha não encontrada.');
        }

        const result = {
            ...ticket,
            desk: formatDesk(desk),
            recalledAt: new Date().toISOString()
        };

        state.currentCall = result;
        pushToHistory(result);
        commit();
        return result;
    });
}

function reset() {
    resetState();
    // Limpa o mapa de intervalos ao zerar
    Object.keys(lastCallByService).forEach(key => delete lastCallByService[key]);
    commit();
    return { message: 'Sistema zerado com sucesso!' };
}

module.exports = { createTicket, callNext, recall, reset };
