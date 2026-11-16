const os = require('os');

// IPv4 da máquina na rede local (ignora loopback, Docker e bridges virtuais)
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        if (name.includes('docker') || name.includes('br-') || name.includes('veth') || name.includes('lo')) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

module.exports = { getLocalIp };
