// Estado global das filas, persistido em data/state.json
const fs = require('fs');
const { EventEmitter } = require('events');
const { DATA_DIR, STATE_FILE } = require('./config');

const events = new EventEmitter();

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

fs.mkdirSync(DATA_DIR, { recursive: true });

// O objeto é sempre o mesmo; resetState() troca só o conteúdo,
// então quem importou `state` continua com a referência válida.
const state = loadPersistedState();

function resetState() {
    Object.assign(state, emptyState());
}

// Salva em disco e avisa os ouvintes (tempo real) que o estado mudou
function commit() {
    saveState();
    events.emit('change', state);
}

module.exports = { state, resetState, commit, events };
