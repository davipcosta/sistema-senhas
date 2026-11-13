function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('pt-BR');
    document.getElementById('clock-date').innerText = now.toLocaleDateString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

fetch('/api/info')
    .then(res => res.ok ? res.json() : null)
    .then(info => {
        if (!info || !info.networkUrl) return;
        document.getElementById('network-url').innerText = info.networkUrl;
        document.getElementById('network-hint').hidden = false;
    })
    .catch(() => {});
