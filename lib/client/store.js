'use client';

// Estado do servidor espelhado no navegador e comunicação em tempo real
// (substitui o antigo public/js/shared.js).
import { useEffect, useSyncExternalStore } from 'react';

export const SERVICES = ['Vara Criminal', 'Família', 'Execução Penal'];

export function emptyState() {
    return {
        counters: { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
        queues: { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
        prioCounter: 0,
        currentCall: null,
        history: []
    };
}

// null = ainda não recebemos nada do servidor
let serverState = null;
// Contador local de preferenciais seguidas (espelha state.prioCounter do servidor)
let localPrioCount = 0;
const listeners = new Set();

let ws = null;
let reconnectTimer = null;

function setState(next) {
    if (!next) return;
    serverState = next;
    if (typeof next.prioCounter === 'number') localPrioCount = next.prioCounter;
    listeners.forEach(fn => fn());
}

function current() {
    return serverState || emptyState();
}

// --- WebSocket nativo -------------------------------------------------------

function initWebSocket() {
    if (typeof window === 'undefined' || ws) return;

    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onopen = () => {
            console.log('Conectado via WebSocket Nativo');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'stateUpdate' || message.type === 'STATE_UPDATE') {
                    setState(message.data || message.payload || message.state);
                }
            } catch (err) {
                console.error('Erro ao processar mensagem do WebSocket:', err);
            }
        };

        ws.onclose = () => {
            ws = null;
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
        ws = null;
        console.error('Falha ao iniciar WebSocket:', e);
    }
}

function sendWsMessage(type, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
        return true;
    }
    return false;
}

function subscribe(fn) {
    listeners.add(fn);
    initWebSocket();
    return () => listeners.delete(fn);
}

const getSnapshot = () => serverState;
const getServerSnapshot = () => null;

// Estado atual do servidor (null até a primeira resposta). Mantém o WebSocket
// aberto e busca o estado pela API REST na montagem.
export function useServerState() {
    const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    useEffect(() => {
        getData();
    }, []);
    return state;
}

// --- API REST (com reserva local quando o servidor não responde) ------------

export function getPrefixByService(service) {
    switch (service) {
        case 'Vara Criminal': return 'CRIM';
        case 'Família': return 'FAM';
        case 'Execução Penal': return 'PEN';
        default: return 'ATD';
    }
}

export function formatDesk(desk) {
    const digits = desk ? desk.toString().replace(/\D/g, '') : '';
    return digits ? digits.padStart(2, '0') : (desk || '01');
}

async function postJson(url, body) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

// Busca o estado atual pela API REST
export async function getData() {
    try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            setState(data);
            return data;
        }
    } catch (e) {
        console.warn('Servidor offline ou sem rota /api/state. Usando dados locais.', e);
    }
    return current();
}

// Gera nova senha com prefixo por setor (CRIM, FAM, PEN)
export async function generateTicket(service, category) {
    const prefix = getPrefixByService(service);

    try {
        const res = await postJson('/api/tickets', { service, category, prefix });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('Erro ao conectar com API REST, tentando via WebSocket / local...', e);
    }

    if (sendWsMessage('NEW_TICKET', { service, category, prefix })) {
        console.log('Senha solicitada via WebSocket');
    }

    // Reserva local se o backend não responder
    const state = structuredClone(current());
    state.counters[prefix] = (state.counters[prefix] || 0) + 1;
    const ticket = {
        code: `${prefix}-${String(state.counters[prefix]).padStart(3, '0')}`,
        service,
        category,
        createdAt: new Date().toISOString()
    };
    (state.queues[category] = state.queues[category] || []).push(ticket);
    setState(state);
    return ticket;
}

function pushToHistory(state, call) {
    const counts = {};
    state.history = [call, ...(state.history || []).filter(h => h.code !== call.code)]
        .filter(item => {
            const svc = item.service || 'Geral';
            counts[svc] = (counts[svc] || 0) + 1;
            return counts[svc] <= 5;
        });
}

// Chama o próximo da fila com a mesma regra do servidor (lib/server/queue.js):
// 1. Até 2 preferenciais seguidas; entre elas, Idoso (80+) vem antes de Prioridade Legal.
// 2. Depois disso, 1 Normal (se houver) e o contador volta a zero.
// 3. Sem Normais na fila, continua chamando preferenciais.
// A lógica local abaixo só roda se a API REST não responder.
export async function callNextTicket(desk, serviceFilter = 'ALL') {
    try {
        const res = await postJson('/api/call', { desk, serviceFilter });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('Erro na chamada REST, processando localmente...', e);
    }

    const state = structuredClone(current());
    const matches = item => serviceFilter === 'ALL' || item.service === serviceFilter;
    const hasItems = category => (state.queues[category] || []).some(matches);
    const popFromQueue = (category) => {
        const queue = state.queues[category] || [];
        const index = queue.findIndex(matches);
        return index !== -1 ? queue.splice(index, 1)[0] : null;
    };
    const popPreferencial = () => popFromQueue(hasItems('IDOSO') ? 'IDOSO' : 'PRIORIDADE');

    const preferenciaisDisponiveis = hasItems('IDOSO') || hasItems('PRIORIDADE');
    let chosenTicket = null;
    let prioCount = localPrioCount;

    if (prioCount < 2 && preferenciaisDisponiveis) {
        chosenTicket = popPreferencial();
        prioCount++;
    } else if (hasItems('NORMAL')) {
        chosenTicket = popFromQueue('NORMAL');
        prioCount = 0;
    } else if (preferenciaisDisponiveis) {
        chosenTicket = popPreferencial();
    }

    if (!chosenTicket) return null;

    chosenTicket.desk = formatDesk(desk);
    chosenTicket.calledAt = new Date().toISOString();
    state.currentCall = chosenTicket;
    state.prioCounter = prioCount;
    pushToHistory(state, chosenTicket);
    setState(state);

    sendWsMessage('CALL_TICKET', { desk, serviceFilter });
    return chosenTicket;
}

// Rechamada de senha no histórico
export async function recallTicket(code, desk) {
    try {
        const res = await postJson('/api/recall', { code, desk });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('Erro na rechamada REST...', e);
    }

    const state = structuredClone(current());
    const found = (state.history || []).find(item => item.code === code);
    if (!found) return null;

    const ticket = { ...found, desk: formatDesk(desk), recalledAt: new Date().toISOString() };
    state.currentCall = ticket;
    pushToHistory(state, ticket);
    setState(state);

    sendWsMessage('RECALL_TICKET', { code, desk });
    return ticket;
}

// Zerar filas e contadores
export async function resetSystem() {
    try {
        await fetch('/api/reset', { method: 'POST' });
    } catch (e) {
        console.warn('Erro ao resetar sistema via REST...', e);
    }

    localPrioCount = 0;
    setState(emptyState());
    sendWsMessage('RESET_SYSTEM');
}
