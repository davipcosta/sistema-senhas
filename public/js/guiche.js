const CALL_COOLDOWN_MS = 8000;

// Cooldown individual por setor (timestamp)
const cooldownsByService = {
    'Vara Criminal': 0,
    'Família': 0,
    'Execução Penal': 0,
    'ALL': 0
};

// Estado de requisição/processamento individual por setor (booleano)
const processingByService = {
    'Vara Criminal': false,
    'Família': false,
    'Execução Penal': false,
    'ALL': false
};

let callCooldownTimer = null;
let currentServiceFilter = 'Vara Criminal';

// Retorna a quantidade total de senhas aguardando no setor ativo
function getFilteredQueueCount() {
    if (!window.serverState || !window.serverState.queues) return 0;

    let total = 0;
    const queues = window.serverState.queues;

    Object.keys(queues).forEach(cat => {
        if (Array.isArray(queues[cat])) {
            if (currentServiceFilter === 'ALL') {
                total += queues[cat].length;
            } else {
                total += queues[cat].filter(item => item.service === currentServiceFilter).length;
            }
        }
    });

    return total;
}

function refreshCallButtonState() {
    const btn = document.querySelector('.btn-call');
    const status = document.getElementById('call-status');

    // Verifica cooldown e processamento isoladamente para o SETOR ATIVO
    const serviceUntil = cooldownsByService[currentServiceFilter] || 0;
    const isProcessing = processingByService[currentServiceFilter] || false;
    const remaining = Math.max(0, serviceUntil - Date.now());

    const totalQueue = getFilteredQueueCount();

    const cooldownActive = isProcessing || remaining > 0;
    const noQueueAvailable = totalQueue === 0;
    const blocked = cooldownActive || noQueueAvailable;

    btn.disabled = blocked;
    btn.style.opacity = blocked ? '0.7' : '1';
    btn.style.cursor = blocked ? 'not-allowed' : 'pointer';

    if (isProcessing) {
        btn.textContent = 'PROCESSANDO...';
        status.textContent = `Processando chamada para "${currentServiceFilter}"...`;
        status.style.display = 'block';
        return;
    }

    if (remaining > 0) {
        const secondsLeft = Math.ceil(remaining / 1000);
        btn.textContent = `AGUARDE ${secondsLeft}s`;
        status.textContent = `Aguarde ${secondsLeft}s para chamar novamente no setor "${currentServiceFilter}".`;
        status.style.display = 'block';
        return;
    }

    if (noQueueAvailable) {
        btn.textContent = 'SEM FILA';
        status.textContent = currentServiceFilter === 'ALL' 
            ? 'Nenhuma senha aguardando na fila geral.' 
            : `Nenhuma senha aguardando para o setor "${currentServiceFilter}".`;
        status.style.display = 'block';
        return;
    }

    btn.textContent = 'CHAMAR PRÓXIMO';
    status.textContent = '';
    status.style.display = 'none';
}

function startCallCooldown(service) {
    cooldownsByService[service] = Date.now() + CALL_COOLDOWN_MS;
    refreshCallButtonState();
    applyHistoryButtonState();

    if (!callCooldownTimer) {
        callCooldownTimer = setInterval(() => {
            refreshCallButtonState();
            applyHistoryButtonState();

            const anyActive = Object.values(cooldownsByService).some(until => Date.now() < until);
            const anyProcessing = Object.values(processingByService).some(isProc => isProc);

            if (!anyActive && !anyProcessing) {
                clearInterval(callCooldownTimer);
                callCooldownTimer = null;
                refreshCallButtonState();
                applyHistoryButtonState();
            }
        }, 250);
    }
}

function applyHistoryButtonState() {
    const historyButtons = document.querySelectorAll('#history-list-guiche button');
    const serviceUntil = cooldownsByService[currentServiceFilter] || 0;
    const isProcessing = processingByService[currentServiceFilter] || false;
    const blocked = isProcessing || (Date.now() < serviceUntil);

    historyButtons.forEach(button => {
        button.disabled = blocked;
        button.style.opacity = blocked ? '0.6' : '1';
        button.style.cursor = blocked ? 'not-allowed' : 'pointer';
    });
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('pt-BR');
    document.getElementById('clock-date').innerText = now.toLocaleDateString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

function getFilteredHistory(history = []) {
    if (currentServiceFilter === 'ALL') {
        const countByService = {};
        return history.filter(item => {
            const svc = item.service || 'Geral';
            countByService[svc] = (countByService[svc] || 0) + 1;
            return countByService[svc] <= 5;
        });
    }
    return history.filter(item => item.service === currentServiceFilter).slice(0, 5);
}

function syncSectorButtons() {
    document.querySelectorAll('.sector-btn').forEach(button => {
        const isActive = button.dataset.sector === currentServiceFilter;
        button.classList.toggle('active', isActive);
    });
}

function setActiveServiceFilter(value) {
    currentServiceFilter = value;
    syncSectorButtons();
    updateUI(window.serverState);
}

async function updateUI(serverState) {
    const data = serverState || await getData();
    if (!data) return;

    window.serverState = data;

    if (data.queues) {
        const countCategory = (cat) => {
            const list = data.queues[cat] || [];
            if (currentServiceFilter === 'ALL') return list.length;
            return list.filter(item => item.service === currentServiceFilter).length;
        };

        document.getElementById('count-idoso').innerText = countCategory('IDOSO');
        document.getElementById('count-prio').innerText = countCategory('PRIORIDADE');
        document.getElementById('count-normal').innerText = countCategory('NORMAL');
    }

    refreshCallButtonState();

    const historyContainer = document.getElementById('history-list-guiche');
    const history = getFilteredHistory(data.history || []);

    if (history.length === 0) {
        const emptyMessage = currentServiceFilter === 'ALL'
            ? 'Nenhuma chamada realizada ainda.'
            : `Nenhuma chamada para ${currentServiceFilter} no histórico.`;
        historyContainer.innerHTML = `<div style="padding: 12px; text-align: center; color: #888;">${emptyMessage}</div>`;
        return;
    }

    historyContainer.innerHTML = history.map(item => {
        const badgeClass = item.category === 'IDOSO' ? 'badge-idoso' :
                           item.category === 'PRIORIDADE' ? 'badge-prio' : 'badge-normal';
        let deskFormatted = item.desk ? String(item.desk).padStart(2, '0') : '--';

        return `
            <div class="history-row">
                <span class="history-cell desk-cell" style="font-weight:700;">Guichê ${deskFormatted}</span>
                <strong class="history-cell code-cell">${item.code}</strong>
                <span class="history-cell service-cell">${item.service || '--'}</span>
                <span class="history-cell category-cell">
                    <span class="badge ${badgeClass}">${item.category}</span>
                </span>
                <div class="history-cell action-cell" style="text-align: right;">
                    <button class="btn-recall" onclick="rechamar('${item.code}')">Rechamar</button>
                </div>
            </div>
        `;
    }).join('');

    applyHistoryButtonState();
}

document.querySelectorAll('.sector-btn').forEach(button => {
    button.addEventListener('click', () => {
        setActiveServiceFilter(button.dataset.sector);
    });
});

syncSectorButtons();

async function call(deskNum, filterValue) {
    const serviceUntil = cooldownsByService[filterValue] || 0;
    const isProcessing = processingByService[filterValue] || false;

    if (isProcessing || Date.now() < serviceUntil) {
        refreshCallButtonState();
        return;
    }

    // Marca o estado de processamento EXCLUSIVAMENTE para este setor
    processingByService[filterValue] = true;
    refreshCallButtonState();

    try {
        const ticket = await callNextTicket(deskNum, filterValue);

        if (!ticket) {
            const status = document.getElementById('call-status');
            status.textContent = 'Nenhuma senha aguardando para esse filtro.';
            status.style.display = 'block';
            return;
        }

        document.getElementById('last-g1').innerText = `${ticket.code} - ${ticket.service} (${ticket.category})`;
        await updateUI();
    } finally {
        processingByService[filterValue] = false;
        startCallCooldown(filterValue);
    }
}

function chamarSelecionado() {
    const deskNum = document.getElementById('select-guiche').value;
    const filterValue = currentServiceFilter;
    call(deskNum, filterValue);
}

async function rechamar(code) {
    const serviceUntil = cooldownsByService[currentServiceFilter] || 0;
    const isProcessing = processingByService[currentServiceFilter] || false;

    if (isProcessing || Date.now() < serviceUntil) {
        refreshCallButtonState();
        return;
    }

    const deskNum = document.getElementById('select-guiche').value;
    const filterValue = currentServiceFilter;

    if (filterValue !== 'ALL') {
        const currentHistory = window.serverState && window.serverState.history ? window.serverState.history : [];
        const ticket = currentHistory.find(item => item.code === code);
        if (!ticket || ticket.service !== filterValue) {
            const status = document.getElementById('call-status');
            status.textContent = `Essa senha não pertence ao serviço "${filterValue}".`;
            status.style.display = 'block';
            return;
        }
    }

    processingByService[filterValue] = true;
    refreshCallButtonState();
    applyHistoryButtonState();

    try {
        const ticket = await recallTicket(code, deskNum);
        if (ticket) {
            document.getElementById('last-g1').innerText = `${ticket.code} - ${ticket.service} (${ticket.category})`;
            await updateUI();
        }
    } finally {
        processingByService[filterValue] = false;
        startCallCooldown(filterValue);
    }
}

async function confirmarZerar() {
    if (confirm('Tem certeza que deseja zerar TODA a fila e o histórico de chamadas?')) {
        await resetSystem();
        document.getElementById('last-g1').innerText = '--';
        await updateUI();
    }
}

async function initGuiche() {
    const data = await getData();
    updateUI(data);
}
initGuiche();
