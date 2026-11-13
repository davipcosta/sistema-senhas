// Rotas REST em /api
const express = require('express');
const { state } = require('./state');
const queue = require('./queue');
const { getSpeechFile } = require('./tts');
const { getLocalIp } = require('./network');
const { PORT } = require('./config');

const router = express.Router();

function sendError(res, error, fallbackMessage) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || fallbackMessage });
}

// Estado completo
router.get('/state', (req, res) => res.json(state));

// Gerar senha
router.post('/tickets', (req, res) => {
    const { service, category, prefix = 'ATD' } = req.body;
    res.json(queue.createTicket({ service, category, prefix }));
});

// Chamar próximo
router.post('/call', async (req, res) => {
    try {
        const { desk, serviceFilter = 'ALL' } = req.body;
        res.json(await queue.callNext(desk, serviceFilter));
    } catch (error) {
        sendError(res, error, 'Erro ao chamar próximo.');
    }
});

// Rechamar
router.post('/recall', async (req, res) => {
    try {
        const { code, desk } = req.body;
        res.json(await queue.recall(code, desk));
    } catch (error) {
        sendError(res, error, 'Erro ao rechamar.');
    }
});

// Zerar
router.post('/reset', (req, res) => {
    res.json(queue.reset());
});

// Voz TTS padronizada
router.get('/tts', async (req, res) => {
    try {
        const text = (req.query.text || '').trim();
        if (!text) return res.status(400).send('Texto não fornecido');

        const filePath = await getSpeechFile(text);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.sendFile(filePath);
    } catch (error) {
        console.error('Erro ao gerar TTS:', error.message || error);
        res.status(500).json({ error: 'Erro ao sintetizar áudio.' });
    }
});

// Endereço de acesso pela rede local (usado no QR Code do totem)
router.get('/info', (req, res) => {
    const ip = getLocalIp();
    res.json({ ip, port: PORT, networkUrl: `http://${ip}:${PORT}` });
});

module.exports = router;
