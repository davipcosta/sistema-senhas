// Relógio no topo da tela
function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('pt-BR');
    document.getElementById('clock-date').innerText = now.toLocaleDateString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

let selectedService = '';
let selectedCategory = 'NORMAL';
let resetTimer = null;
let serverInfo = null;

// Obtém o IP da rede local fornecido pelo servidor
async function fetchServerInfo() {
    try {
        const res = await fetch('/api/info');
        if (res.ok) {
            serverInfo = await res.json();
        }
    } catch (e) {
        console.warn('Não foi possível obter informações de rede do servidor:', e);
    }
}
fetchServerInfo();

function getBaseUrlForClient() {
    if (serverInfo && serverInfo.networkUrl) {
        // Se o totem foi aberto via localhost, usa o IP da rede local para que o celular consiga acessar
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return serverInfo.networkUrl;
        }
    }
    return window.location.origin;
}

function renderQRCode(url) {
    const qrDiv = document.getElementById('ticket-qrcode');
    const qrFallback = document.getElementById('ticket-qrcode-fallback');
    qrDiv.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(qrDiv, {
                text: url,
                width: 120,
                height: 120,
                colorDark: '#004825',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            qrDiv.style.display = 'flex';
            qrFallback.style.display = 'none';
            return;
        } catch (e) {
            console.warn('Erro ao gerar via QRCode.js, usando fallback:', e);
        }
    }

    qrDiv.style.display = 'none';
    qrFallback.style.display = 'block';
    qrFallback.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
}

function selectService(service) {
    selectedService = service;
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'block';
}

function selectCategory(category, element) {
    selectedCategory = category;
    document.querySelectorAll('#category-options .option-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
}

async function confirmAndGenerate() {
    const ticket = await generateTicket(selectedService, selectedCategory);

    if (!ticket) return;

    document.getElementById('modal-ticket-code').innerText = ticket.code;
    document.getElementById('modal-service').innerText = ticket.service;

    const badgeMap = {
        'IDOSO': '<span class="badge badge-idoso" style="display:inline-block; margin-top:8px;">IDOSO (80+)</span>',
        'PRIORIDADE': '<span class="badge badge-prio" style="display:inline-block; margin-top:8px;">PRIORIDADE</span>',
        'NORMAL': '<span class="badge badge-normal" style="display:inline-block; margin-top:8px;">NORMAL</span>'
    };
    document.getElementById('modal-badge').innerHTML = badgeMap[ticket.category] || '';

    // Gera QR Code com URL alcançável pelo celular na rede local (Wi-Fi)
    const baseUrl = getBaseUrlForClient();
    const clientUrl = `${baseUrl}/cliente.html?ticket=${encodeURIComponent(ticket.code)}`;
    renderQRCode(clientUrl);
    const directLink = document.getElementById('link-cliente-direto');
    directLink.href = clientUrl;

    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-ticket').style.display = 'block';

    resetTimer = setTimeout(resetFlow, 10000);
}

function resetFlow() {
    if (resetTimer) clearTimeout(resetTimer);
    selectedService = '';
    selectedCategory = 'NORMAL';

    const categoryButtons = document.querySelectorAll('#category-options .option-btn');
    categoryButtons.forEach(btn => btn.classList.remove('selected'));
    if (categoryButtons[0]) categoryButtons[0].classList.add('selected');

    document.getElementById('step-ticket').style.display = 'none';
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-1').style.display = 'block';
}
