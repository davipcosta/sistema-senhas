// Define Vara Criminal como padrão inicial
let currentPanelSector = 'Vara Criminal';
const audioPlayer = new Audio();
let audioContext = null;
let ultimaChamadaFaladaId = null;

// Relógio no topo da tela
function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('pt-BR');
    document.getElementById('clock-date').innerText = now.toLocaleDateString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

// --- BUSCA DA PREVISÃO DO TEMPO (Belém - Lat: -1.4558, Lon: -48.4902) ---
async function fetchBelémWeather() {
    try {
        const response = await fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=-1.4558&longitude=-48.4902&current=temperature_2m,relative_humidity_2m,weather_code&timezone=America%2FBelem'
        );
        const data = await response.json();

        if (data && data.current) {
            const temp = Math.round(data.current.temperature_2m);
            const humidity = data.current.relative_humidity_2m;
            const code = data.current.weather_code;

            let desc = 'Ensolarado';
            let icon = '☀️';

            if ([1, 2, 3].includes(code)) {
                desc = 'Parcialmente Nublado';
                icon = '🌤️';
            } else if ([45, 48].includes(code)) {
                desc = 'Névoa';
                icon = '🌫️';
            } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
                desc = 'Chuva / Pancadas';
                icon = '🌧️';
            } else if ([95, 96, 99].includes(code)) {
                desc = 'Temporal com Trovoadas';
                icon = '⛈️';
            }

            document.getElementById('weather-info').innerText = `${icon} Belém ${temp}°C (${desc}) • Umidade: ${humidity}%`;
        }
    } catch (error) {
        console.warn('Não foi possível obter a previsão do tempo:', error);
        document.getElementById('weather-info').innerText = '☀️ Belém 31°C (Ensolarado)';
    }
}

fetchBelémWeather();
setInterval(fetchBelémWeather, 15 * 60 * 1000);

// --- SINTETIZADOR DE VOZ UNIFICADO ---
function tocarGongo() {
    return new Promise((resolve) => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return resolve();
            if (!audioContext) audioContext = new AudioCtx();
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            const now = audioContext.currentTime;

            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(698.46, now);
            gain1.gain.setValueAtTime(0.28, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            osc1.start(now);
            osc1.stop(now + 0.55);

            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(523.25, now + 0.22);
            gain2.gain.setValueAtTime(0.32, now + 0.22);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.start(now + 0.22);
            osc2.stop(now + 0.85);

            setTimeout(resolve, 800);
        } catch (e) {
            console.warn('Não foi possível tocar o gongo:', e);
            resolve();
        }
    });
}

async function falarChamada(texto) {
    try {
        await tocarGongo();
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.src = `/api/tts?text=${encodeURIComponent(texto)}`;
        await audioPlayer.play();
    } catch (e) {
        console.warn('Áudio aguardando interação inicial do usuário:', e);
    }
}

function desbloquearAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}
window.addEventListener('click', desbloquearAudio);
window.addEventListener('keydown', desbloquearAudio);
window.addEventListener('touchstart', desbloquearAudio);

function formatarSenhaParaVoz(codigo) {
    if (!codigo) return '';
    const partes = codigo.split('-');
    if (partes.length === 2) {
        const prefixo = partes[0].split('').join(' ');
        const numero = partes[1].split('').join(' ');
        return `${prefixo}, ${numero}`;
    }
    return codigo.split('').join(' ');
}

// --- CONTROLE DOS BOTÕES DE FILTRO ---
document.querySelectorAll('.panel-sector-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.panel-sector-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentPanelSector = button.dataset.sector;
        renderPanel(window.serverState);
    });
});

// Função de renderização com filtro de setor ativo
async function renderPanel(serverState) {
    const data = serverState || await getData();
    if (!data) return;

    window.serverState = data;

    const history = data.history || [];

    const filteredHistory = currentPanelSector === 'ALL'
        ? history
        : history.filter(item => item.service === currentPanelSector);

    const call = filteredHistory.length > 0 ? filteredHistory[0] : null;      
    const callBox = document.getElementById('main-call-box');

    if (call) {
        document.getElementById('current-ticket').innerText = call.code;

        const categoriaTexto = call.category === 'IDOSO' ? 'Idoso (80+)' : 
                              call.category === 'PRIORIDADE' ? 'Prioridade' : 'Atendimento Geral';
        const servicoTexto = call.service || '';

        const informacaoCombinada = servicoTexto 
            ? `${categoriaTexto} • ${servicoTexto}` 
            : categoriaTexto;

        document.getElementById('current-category').innerText = informacaoCombinada;

        let formattedDesk = call.desk.toString().replace(/\D/g, ''); 
        formattedDesk = formattedDesk ? formattedDesk.padStart(2, '0') : call.desk;
        document.getElementById('current-desk').innerText = `Guichê ${formattedDesk}`;

        callBox.classList.remove('call-normal', 'call-prio', 'call-idoso');
        if (call.category === 'IDOSO') {
            callBox.classList.add('call-idoso');
        } else if (call.category === 'PRIORIDADE') {
            callBox.classList.add('call-prio');
        } else {
            callBox.classList.add('call-normal');
        }

        const chamadaId = `${call.code}_${formattedDesk}_${call.calledAt || ''}_${call.recalledAt || ''}`;

        if (chamadaId !== ultimaChamadaFaladaId) {
            ultimaChamadaFaladaId = chamadaId;

            callBox.classList.remove('pulse-animation');
            void callBox.offsetWidth;
            callBox.classList.add('pulse-animation');

            const senhaFalada = formatarSenhaParaVoz(call.code);
            const textoChamada = `Senha ${senhaFalada}. Guichê ${formattedDesk}.`;
            falarChamada(textoChamada);
        }
    } else {
        document.getElementById('current-ticket').innerText = '---';
        document.getElementById('current-category').innerText = currentPanelSector === 'ALL' 
            ? 'Aguardando Chamada' 
            : `Aguardando chamada para ${currentPanelSector}`;
        document.getElementById('current-desk').innerText = 'Guichê --';
        callBox.className = 'current-call-box call-normal';
    }

    const historyList = document.getElementById('history-list');
    const historyItems = filteredHistory.length > 1 ? filteredHistory.slice(1, 6) : [];

    if (historyItems.length === 0) {
        const emptyMessage = currentPanelSector === 'ALL'
            ? 'Aguardando chamadas...'
            : `Nenhuma chamada recente para ${currentPanelSector}`;
        historyList.innerHTML = `<div style="color: var(--text-muted); padding: 18px; text-align: center; font-weight: 600; background: var(--bg-main); border-radius: 14px;">${emptyMessage}</div>`;
        return;
    }

    historyList.innerHTML = historyItems.map(item => {
        let deskFormatted = item.desk.toString().replace(/\D/g, '');
        deskFormatted = deskFormatted ? deskFormatted.padStart(2, '0') : item.desk;

        let itemClass = 'history-item';
        if (item.category === 'IDOSO') itemClass += ' item-idoso';
        else if (item.category === 'PRIORIDADE') itemClass += ' item-prio';

        return `
            <div class="${itemClass}">
                <div>
                    <div class="ticket-code">${item.code}</div>
                    <small style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; display: block; margin-top: 2px;">
                        ${item.service || ''} • ${item.category || ''}
                    </small>
                </div>
                <span class="desk-code">Guichê ${deskFormatted}</span>
            </div>
        `;
    }).join('');
}

async function initPanel() {
    const data = await getData();
    if (data && data.currentCall) {
        const call = data.currentCall;
        let formattedDesk = call.desk.toString().replace(/\D/g, '');
        formattedDesk = formattedDesk ? formattedDesk.padStart(2, '0') : call.desk;
        ultimaChamadaFaladaId = `${call.code}_${formattedDesk}_${call.calledAt || ''}_${call.recalledAt || ''}`;
    }
    renderPanel(data);
}
initPanel();
