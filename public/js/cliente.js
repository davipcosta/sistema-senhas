let myTicketCode = null;
let jaVibrou = false;

function getParamTicket() {
    const params = new URLSearchParams(window.location.search);
    return params.get('ticket') || params.get('code') || params.get('id');
}

function buscarManualmente() {
    const val = document.getElementById('input-ticket').value.trim().toUpperCase();
    if (val) {
        myTicketCode = val;
        history.pushState(null, '', `?ticket=${encodeURIComponent(val)}`);
        renderClient(window.serverState);
    }
}

function trocarSenha() {
    myTicketCode = null;
    history.pushState(null, '', window.location.pathname);
    renderClient(window.serverState);
}

function vibrarAparelho() {
    try {
        if ('vibrate' in navigator) {
            navigator.vibrate([400, 200, 400, 200, 400]);
        }
    } catch (e) {}
}

function renderClient(state) {
    if (!state) return;

    myTicketCode = myTicketCode || getParamTicket();

    // Atualiza o painel da TV ao vivo
    if (state.currentCall) {
        document.getElementById('tv-code').innerText = state.currentCall.code;
        document.getElementById('tv-service').innerText = `${state.currentCall.service || ''} (${state.currentCall.category || ''})`;
        let d = state.currentCall.desk ? String(state.currentCall.desk).padStart(2, '0') : '01';
        document.getElementById('tv-desk').innerText = `Guichê ${d}`;
    } else {
        document.getElementById('tv-code').innerText = '---';
        document.getElementById('tv-service').innerText = 'Aguardando chamadas...';
        document.getElementById('tv-desk').innerText = 'Guichê --';
    }

    // Se não tem senha definida, mostra o input de busca
    if (!myTicketCode) {
        document.getElementById('form-search').style.display = 'block';
        document.getElementById('card-my-ticket').style.display = 'none';
        document.getElementById('card-status').style.display = 'none';
        return;
    }

    document.getElementById('form-search').style.display = 'none';
    document.getElementById('card-my-ticket').style.display = 'block';
    document.getElementById('card-status').style.display = 'block';

    document.getElementById('lbl-my-code').innerText = myTicketCode;

    const currentCall = state.currentCall;
    const history = state.history || [];
    const queues = state.queues || { IDOSO: [], PRIORIDADE: [], NORMAL: [] };

    const isCurrent = currentCall && currentCall.code === myTicketCode;
    const inHistory = history.find(h => h.code === myTicketCode);

    // Concatena todas as filas respeitando a ordem de prioridade (IDOSO -> PRIORIDADE -> NORMAL)
    const allQueue = [
        ...(queues.IDOSO || []),
        ...(queues.PRIORIDADE || []),
        ...(queues.NORMAL || [])
    ];

    // Localiza o objeto do ticket na fila completa
    const ticketInQueue = allQueue.find(item => item.code === myTicketCode);
    const itemTicket = ticketInQueue || (isCurrent ? currentCall : inHistory);

    if (itemTicket) {
        document.getElementById('lbl-my-service').innerText = itemTicket.service || 'Atendimento Geral';
        const catClass = itemTicket.category === 'IDOSO' ? 'badge-idoso' :
                        itemTicket.category === 'PRIORIDADE' ? 'badge-prio' : 'badge-normal';
        document.getElementById('lbl-my-badge').innerHTML = `<span class="badge ${catClass}">${itemTicket.category}</span>`;
    }

    // --- FILTRAGEM DA FILA POR SERVIÇO ---
    let peopleAheadSameService = 0;
    let inQueue = false;

    if (ticketInQueue) {
        inQueue = true;
        const myService = ticketInQueue.service;

        // Filtra a fila completa mantendo apenas quem é do mesmo serviço
        const serviceQueue = allQueue.filter(item => item.service === myService);

        // Posição do usuário dentro da fila específica do serviço dele
        const serviceIndex = serviceQueue.findIndex(item => item.code === myTicketCode);

        peopleAheadSameService = serviceIndex !== -1 ? serviceIndex : 0;
    }

    const card = document.getElementById('card-status');
    const icon = document.getElementById('status-icon');
    const title = document.getElementById('status-title');
    const content = document.getElementById('status-content');

    card.className = 'status-box';

    if (isCurrent) {
        card.classList.add('status-called');
        icon.innerText = '🔔';
        title.innerText = 'SUA VEZ! DIRIJA-SE AO';
        let deskFormat = currentCall.desk ? String(currentCall.desk).padStart(2, '0') : '01';
        content.innerHTML = `
            <div class="called-desk">GUICHÊ ${deskFormat}</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF;">Compareça agora ao atendimento!</div>
        `;
        if (!jaVibrou) {
            jaVibrou = true;
            vibrarAparelho();
        }
    } else if (inQueue) {
        card.classList.add('status-waiting');
        icon.innerText = '⏳';
        title.innerText = 'Aguardando na Fila';
        content.innerHTML = `
            <div class="status-num">${peopleAheadSameService}</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted);">
                ${peopleAheadSameService === 0 
                    ? 'Você é o próximo a ser chamado para este serviço!' 
                    : 'Pessoa(s) aguardando na sua frente para este serviço'}
            </div>
        `;
    } else if (inHistory) {
        card.classList.add('status-done');
        icon.innerText = '✅';
        title.innerText = 'Atendimento Concluído';
        let d = inHistory.desk ? String(inHistory.desk).padStart(2, '0') : '--';
        content.innerHTML = `
            <div style="font-size: 1.15rem; font-weight: 800; color: #1E293B; margin: 10px 0 4px;">Chamado no Guichê ${d}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Se não foi atendido, solicite rechamada no guichê.</div>
        `;
    } else {
        card.classList.add('status-done');
        icon.innerText = '❓';
        title.innerText = 'Senha não localizada';
        content.innerHTML = `
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-top: 8px;">
                Verifique se o código foi digitado corretamente.
            </div>
        `;
    }
}

function updateUI(state) {
    renderClient(state);
}

async function init() {
    const data = await getData();
    renderClient(data);
}
init();
