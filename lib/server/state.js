// Estado global das filas, persistido em data/state.json
const fs = require('fs');
const { EventEmitter } = require('events');
const { DATA_DIR, STATE_FILE } = require('./config');

function emptyState() {
    return {
        queues: { IDOSO: [], PRIORIDADE: [], NORMAL: [] },
        counters: { CRIM: 0, FAM: 0, PEN: 0, ATD: 0 },
        prioCounter: 0,
        currentCall: null,
        history: []
    };
}

function loadPersistedState() {
    const initial = emptyState();
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            console.log('[Persistência] Estado recuperado com sucesso de data/state.json');
            return {
                queues: data.queues || initial.queues,
                counters: data.counters || initial.counters,
                prioCounter: data.prioCounter || 0,
                currentCall: data.currentCall || null,
                history: data.history || []
            };
        }
    } catch (err) {
        console.error('[Persistência] Falha ao ler arquivo de estado:', err);
    }
    return initial;
}

function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
        console.error('[Persistência] Erro ao salvar estado:', err);
    }
}

// O servidor customizado (server.js) e os Route Handlers do Next carregam
// cópias separadas deste módulo no mesmo processo. Guardar o estado em
// globalThis garante que todos usem o mesmo objeto e o mesmo EventEmitter.
const store = globalThis.__sistemaSenhas || (globalThis.__sistemaSenhas = (() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return {
        // O objeto é sempre o mesmo; resetState() troca só o conteúdo,
        // então quem importou `state` continua com a referência válida.
        state: loadPersistedState(),
        events: new EventEmitter(),
        // Controle de intervalo entre chamadas, isolado por setor (usado em queue.js)
        lastCallByService: {},
        callQueueByService: {}
    };
})());

const { state, events } = store;

function resetState() {
    Object.assign(state, emptyState());
}

// Salva em disco e avisa os ouvintes (tempo real) que o estado mudou
function commit() {
    saveState();
    events.emit('change', state);
}

module.exports = { state, resetState, commit, events, store };
