const path = require('path');

// process.cwd() em vez de __dirname: este arquivo também é empacotado pelo Next
// (Route Handlers), e lá __dirname não aponta para a pasta do projeto.
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');

module.exports = {
    PORT: Number(process.env.PORT) || 3000,

    // Dados gerados em execução
    DATA_DIR,
    STATE_FILE: path.join(DATA_DIR, 'state.json'),
    AUDIO_CACHE_DIR: path.join(DATA_DIR, 'audio_cache'),

    // Intervalo mínimo entre chamadas do mesmo setor
    CALL_INTERVAL_MS: 8000,

    // Quantas chamadas de cada setor ficam no histórico
    HISTORY_PER_SERVICE: 5
};
