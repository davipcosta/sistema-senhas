const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

module.exports = {
    PORT: process.env.PORT || 3000,

    // Arquivos servidos ao navegador (telas, CSS, JS, imagens)
    PUBLIC_DIR: path.join(ROOT_DIR, 'public'),

    // Dados gerados em execução
    DATA_DIR,
    STATE_FILE: path.join(DATA_DIR, 'state.json'),
    AUDIO_CACHE_DIR: path.join(DATA_DIR, 'audio_cache'),

    // Intervalo mínimo entre chamadas do mesmo setor
    CALL_INTERVAL_MS: 8000,

    // Quantas chamadas de cada setor ficam no histórico
    HISTORY_PER_SERVICE: 5
};
