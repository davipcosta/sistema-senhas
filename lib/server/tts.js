// Síntese de voz (Google Translate TTS) com cache em disco
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const googleTTS = require('google-tts-api');
const { AUDIO_CACHE_DIR } = require('./config');

fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

// Retorna o caminho de um MP3 com o texto falado, gerando se ainda não existir
async function getSpeechFile(text) {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const filePath = path.join(AUDIO_CACHE_DIR, `${hash}.mp3`);

    if (!fs.existsSync(filePath)) {
        const base64 = await googleTTS.getAudioBase64(text, {
            lang: 'pt',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000
        });
        await fs.promises.writeFile(filePath, Buffer.from(base64, 'base64'));
    }

    return filePath;
}

module.exports = { getSpeechFile };
