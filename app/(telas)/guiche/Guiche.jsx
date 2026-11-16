'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import Badge from '@/components/Badge';
import {
    SERVICES, emptyState, useServerState, getData,
    callNextTicket, recallTicket, resetSystem
} from '@/lib/client/store';
import styles from './guiche.module.css';

const CALL_COOLDOWN_MS = 8000;
const DESKS = ['1', '2', '3', '4', '5'];

const matchesFilter = (filter) => (item) => filter === 'ALL' || item.service === filter;

function getFilteredHistory(history, filter) {
    if (filter === 'ALL') {
        const countByService = {};
        return history.filter(item => {
            const svc = item.service || 'Geral';
            countByService[svc] = (countByService[svc] || 0) + 1;
            return countByService[svc] <= 5;
        });
    }
    return history.filter(matchesFilter(filter)).slice(0, 5);
}

const formatLastCalled = t => `${t.code} - ${t.service} (${t.category})`;

export default function Guiche() {
    const state = useServerState() || emptyState();
    const [serviceFilter, setServiceFilter] = useState(SERVICES[0]);
    const [desk, setDesk] = useState(DESKS[0]);
    const [lastCalled, setLastCalled] = useState('--');
    const [notice, setNotice] = useState('');
    // Cooldown (timestamp) e processamento, individuais por setor
    const [cooldowns, setCooldowns] = useState({});
    const [processing, setProcessing] = useState({});
    const [now, setNow] = useState(() => Date.now());

    const anyActive = Object.values(processing).some(Boolean) ||
        Object.values(cooldowns).some(until => until > now);

    // Atualiza a contagem regressiva enquanto houver cooldown/processamento
    useEffect(() => {
        if (!anyActive) return;
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [anyActive]);

    const queues = state.queues || {};
    const countCategory = (cat) => (queues[cat] || []).filter(matchesFilter(serviceFilter)).length;
    const totalQueue = Object.values(queues)
        .filter(Array.isArray)
        .reduce((sum, list) => sum + list.filter(matchesFilter(serviceFilter)).length, 0);

    const isProcessing = !!processing[serviceFilter];
    const remaining = Math.max(0, (cooldowns[serviceFilter] || 0) - now);
    const cooldownActive = isProcessing || remaining > 0;
    const callBlocked = cooldownActive || totalQueue === 0;

    let buttonText = 'CHAMAR PRÓXIMO';
    let status = notice;
    if (isProcessing) {
        buttonText = 'PROCESSANDO...';
        status = `Processando chamada para "${serviceFilter}"...`;
    } else if (remaining > 0) {
        const secondsLeft = Math.ceil(remaining / 1000);
        buttonText = `AGUARDE ${secondsLeft}s`;
        status = `Aguarde ${secondsLeft}s para chamar novamente no setor "${serviceFilter}".`;
    } else if (totalQueue === 0) {
        buttonText = 'SEM FILA';
        status = serviceFilter === 'ALL'
            ? 'Nenhuma senha aguardando na fila geral.'
            : `Nenhuma senha aguardando para o setor "${serviceFilter}".`;
    }

    function startCooldown(filter) {
        setProcessing(p => ({ ...p, [filter]: false }));
        setCooldowns(c => ({ ...c, [filter]: Date.now() + CALL_COOLDOWN_MS }));
        setNow(Date.now());
    }

    async function chamarSelecionado() {
        const filter = serviceFilter;
        if (cooldownActive) return;

        setNotice('');
        setProcessing(p => ({ ...p, [filter]: true }));
        try {
            const ticket = await callNextTicket(desk, filter);
            if (!ticket) {
                setNotice('Nenhuma senha aguardando para esse filtro.');
                return;
            }
            setLastCalled(formatLastCalled(ticket));
            await getData();
        } finally {
            startCooldown(filter);
        }
    }

    async function rechamar(code) {
        const filter = serviceFilter;
        if (cooldownActive) return;

        if (filter !== 'ALL') {
            const ticket = (state.history || []).find(item => item.code === code);
            if (!ticket || ticket.service !== filter) {
                setNotice(`Essa senha não pertence ao serviço "${filter}".`);
                return;
            }
        }

        setNotice('');
        setProcessing(p => ({ ...p, [filter]: true }));
        try {
            const ticket = await recallTicket(code, desk);
            if (ticket) {
                setLastCalled(formatLastCalled(ticket));
                await getData();
            }
        } finally {
            startCooldown(filter);
        }
    }

    async function confirmarZerar() {
        if (confirm('Tem certeza que deseja zerar TODA a fila e o histórico de chamadas?')) {
            await resetSystem();
            setLastCalled('--');
            await getData();
        }
    }

    function selectSector(sector) {
        setServiceFilter(sector);
        setNotice('');
    }

    const history = getFilteredHistory(state.history || [], serviceFilter);
    const blockedStyle = (blocked, opacity) => ({
        opacity: blocked ? opacity : 1,
        cursor: blocked ? 'not-allowed' : 'pointer'
    });

    return (
        <>
            <Topbar active="/guiche" />
            <main className="main-container-form">
                <div className="header-title">
                    <span className="eyebrow">Área do Atendente</span>
                    <h1>Controle de Atendimento dos Guichês</h1>
                </div>

                <section className="card">
                    <div className="card-title">Fila de Espera em Tempo Real</div>
                    <div className={styles.queueCounts}>
                        <div className={`${styles.countCard} ${styles.countIdoso}`}>
                            <div className={styles.countLabel}>Idoso (80+)</div>
                            <strong id="count-idoso">{countCategory('IDOSO')}</strong>
                        </div>
                        <div className={`${styles.countCard} ${styles.countPrio}`}>
                            <div className={styles.countLabel}>Prioridade</div>
                            <strong id="count-prio">{countCategory('PRIORIDADE')}</strong>
                        </div>
                        <div className={`${styles.countCard} ${styles.countNormal}`}>
                            <div className={styles.countLabel}>Normal</div>
                            <strong id="count-normal">{countCategory('NORMAL')}</strong>
                        </div>
                    </div>
                </section>

                <section className="card">
                    <div className="card-title">
                        <span>Chamar Atendimento</span>
                    </div>

                    <div className={styles.serviceSelector}>
                        <div className={styles.serviceSelectorLabel}>Filtrar por Setor</div>
                        <div className={styles.serviceOptions}>
                            {SERVICES.map(sector => (
                                <button
                                    key={sector}
                                    type="button"
                                    className={sector === serviceFilter ? `${styles.sectorBtn} ${styles.active}` : styles.sectorBtn}
                                    onClick={() => selectSector(sector)}
                                >
                                    {sector}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <div className={styles.fieldBlock}>
                            <label htmlFor="select-guiche">Identificação do Guichê / Sala</label>
                            <select id="select-guiche" value={desk} onChange={e => setDesk(e.target.value)}>
                                {DESKS.map(d => (
                                    <option key={d} value={d}>Guichê {d.padStart(2, '0')}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        className={styles.btnCall}
                        disabled={callBlocked}
                        style={blockedStyle(callBlocked, 0.7)}
                        onClick={chamarSelecionado}
                    >
                        {buttonText}
                    </button>
                    <div
                        id="call-status"
                        className={styles.callStatus}
                        aria-live="polite"
                        style={{ display: status ? 'block' : 'none' }}
                    >
                        {status}
                    </div>

                    <div className={styles.lastCalledBox}>
                        <span className={styles.lbl}>Último chamado neste guichê</span>
                        <div id="last-g1" className={styles.val}>{lastCalled}</div>
                    </div>
                </section>

                <section className="card">
                    <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Histórico de Chamadas</span>
                        <button className={styles.btnReset} onClick={confirmarZerar}>ZERAR FILAS</button>
                    </div>

                    <div className="history-list" id="history-list-guiche">
                        {history.length === 0 ? (
                            <div style={{ padding: 12, textAlign: 'center', color: '#888' }}>
                                {serviceFilter === 'ALL'
                                    ? 'Nenhuma chamada realizada ainda.'
                                    : `Nenhuma chamada para ${serviceFilter} no histórico.`}
                            </div>
                        ) : history.map(item => (
                            <div className={styles.historyRow} key={item.code}>
                                <span className={styles.historyCell} style={{ fontWeight: 700 }}>
                                    Guichê {item.desk ? String(item.desk).padStart(2, '0') : '--'}
                                </span>
                                <strong className={`${styles.historyCell} ${styles.codeCell}`}>{item.code}</strong>
                                <span className={styles.historyCell}>{item.service || '--'}</span>
                                <span className={styles.historyCell}>
                                    <Badge category={item.category} />
                                </span>
                                <div className={`${styles.historyCell} ${styles.actionCell}`} style={{ textAlign: 'right' }}>
                                    <button
                                        className={styles.btnRecall}
                                        disabled={cooldownActive}
                                        style={blockedStyle(cooldownActive, 0.6)}
                                        onClick={() => rechamar(item.code)}
                                    >
                                        Rechamar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}
