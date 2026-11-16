const { getLocalIp } = require('./lib/server/network');

// URLs antigas (.html) continuam funcionando: favoritos das TVs/totens
// e QR Codes já impressos apontam para /cliente.html?ticket=...
const legacyPages = ['index', 'totem', 'guiche', 'painel', 'cliente'];

/** @type {import('next').NextConfig} */
module.exports = {
    // Permite abrir o modo dev pelo IP da rede local (totem, TVs, celulares)
    allowedDevOrigins: [getLocalIp()],
    serverExternalPackages: ['google-tts-api'],
    turbopack: { root: __dirname },
    async redirects() {
        return legacyPages.map((page) => ({
            source: `/${page}.html`,
            destination: page === 'index' ? '/' : `/${page}`,
            permanent: false
        }));
    }
};
