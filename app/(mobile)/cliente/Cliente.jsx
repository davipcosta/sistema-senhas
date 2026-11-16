'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Badge from '@/components/Badge';
import { useServerState } from '@/lib/client/store';
import styles from './cliente.module.css';

const mutedStyle = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' };
const padDesk = (desk, fallback) => (desk ? String(desk).padStart(2, '0') : fallback);

function vibrarAparelho() {
    try {
        if ('vibrate' in navigator) navigator.vibrate([400, 200, 400, 200, 400]);
    } catch {}
}

function StatusCard({ state, code }) {
    const currentCall = state.currentCall;
    const history = state.history || [];
    const queues = state.queues || {};

    const isCurrent = currentCall && currentCall.code === code;
    const inHistory = history.find(h => h.code === code);

    // Todas as filas na ordem de prioridade (IDOSO → PRIORIDADE → NORMAL)
    const allQueue = [...(queues.IDOSO || []), ...(queues.PRIORIDADE || []), ...(queues.NORMAL || [])];
    const ticketInQueue = allQueue.find(item => item.code === code);

    if (isCurrent) {
        return (
            <section className={`${styles.statusBox} ${styles.statusCalled}`} id="card-status">
                <div id="status-icon" style={{ fontSize: '2rem' }}>🔔</div>
                <div id="status-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>SUA VEZ! DIRIJA-SE AO</div>
                <div id="status-content">
                    <div className={styles.calledDesk}>GUICHÊ {padDesk(currentCall.desk, '01')}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>Compareça agora ao atendimento!</div>
                </div>
            </section>
        );
    }

    if (ticketInQueue) {
        // Posição dentro da fila do mesmo serviço
        const serviceQueue = allQueue.filter(item => item.service === ticketInQueue.service);
        const ahead = Math.max(0, serviceQueue.findIndex(item => item.code === code));
        return (
            <section className={`${styles.statusBox} ${styles.statusWaiting}`} id="card-status">
                <div id="status-icon" style={{ fontSize: '2rem' }}>⏳</div>
                <div id="status-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>Aguardando na Fila</div>
                <div id="status-content">
                    <div className={styles.statusNum}>{ahead}</div>
                    <div style={mutedStyle}>
                        {ahead === 0
                            ? 'Você é o próximo a ser chamado para este serviço!'
                            : 'Pessoa(s) aguardando na sua frente para este serviço'}
                    </div>
                </div>
            </section>
        );
    }

    if (inHistory) {
        return (
            <section className={`${styles.statusBox} ${styles.statusDone}`} id="card-status">
                <div id="status-icon" style={{ fontSize: '2rem' }}>✅</div>
                <div id="status-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>Atendimento Concluído</div>
                <div id="status-content">
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: '10px 0 4px' }}>
                        Chamado no Guichê {padDesk(inHistory.desk, '--')}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Se não foi atendido, solicite rechamada no guichê.
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className={`${styles.statusBox} ${styles.statusDone}`} id="card-status">
            <div id="status-icon" style={{ fontSize: '2rem' }}>❓</div>
            <div id="status-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>Senha não localizada</div>
            <div id="status-content">
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Verifique se o código foi digitado corretamente.
                </div>
            </div>
        </section>
    );
}

export default function Cliente() {
    const state = useServerState();
    const router = useRouter();
    const params = useSearchParams();
    const code = (params.get('ticket') || params.get('code') || params.get('id') || '').toUpperCase() || null;
    const [input, setInput] = useState('');
    const jaVibrou = useRef(false);

    const currentCall = state?.currentCall || null;
    const isCurrent = !!(code && currentCall && currentCall.code === code);

    useEffect(() => {
        if (isCurrent && !jaVibrou.current) {
            jaVibrou.current = true;
            vibrarAparelho();
        }
    }, [isCurrent]);

    function buscarManualmente(e) {
        e.preventDefault();
        const val = input.trim().toUpperCase();
        if (val) router.push(`/cliente?ticket=${encodeURIComponent(val)}`);
    }

    // Dados do próprio ticket (fila, chamada atual ou histórico)
    let myTicket = null;
    if (state && code) {
        const queues = state.queues || {};
        myTicket = [...(queues.IDOSO || []), ...(queues.PRIORIDADE || []), ...(queues.NORMAL || [])]
            .find(item => item.code === code)
            || (isCurrent ? currentCall : (state.history || []).find(h => h.code === code));
    }

    return (
        <>
            <header className={styles.mobileHeader}>
                <div className={styles.brandBox}>
                    <img src="/images/dpepa.svg" alt="DPE-PA" />
                    <div className={styles.brandText}>
                        Defensoria Pública
                        <span>Estado do Pará</span>
                    </div>
                </div>
                <div className={styles.liveBadge}>
                    <div className={styles.liveDot}></div>
                    <span>AO VIVO</span>
                </div>
            </header>

            <main className={styles.mobileContainer}>
                {/* FORMULÁRIO DE DIGITAÇÃO DE SENHA */}
                {state && !code && (
                    <section className={styles.searchBox} id="form-search">
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B' }}>Acompanhar Atendimento</div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Digite o código da sua senha para acompanhar:
                        </p>
                        <form className={styles.searchRow} onSubmit={buscarManualmente}>
                            <input
                                type="text"
                                id="input-ticket"
                                className={styles.searchInput}
                                placeholder="Ex: CRIM-001"
                                maxLength={10}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                            />
                            <button type="submit" className={styles.searchBtn}>BUSCAR</button>
                        </form>
                    </section>
                )}

                {state && code && (
                    <>
                        {/* CARD DA SENHA DO USUÁRIO */}
                        <section className={styles.ticketCard} id="card-my-ticket">
                            <div className={styles.ticketCardLabel}>Sua Senha</div>
                            <div className={styles.ticketCardCode} id="lbl-my-code">{code}</div>
                            <div className={styles.ticketCardService} id="lbl-my-service">
                                {myTicket ? (myTicket.service || 'Atendimento Geral') : '---'}
                            </div>
                            <div id="lbl-my-badge">{myTicket && <Badge category={myTicket.category} />}</div>
                        </section>

                        {/* CARD DE STATUS EM TEMPO REAL */}
                        <StatusCard state={state} code={code} />
                    </>
                )}

                {/* CARD DE CHAMADA ATUAL NA TV */}
                <section className={styles.liveTvBox}>
                    <div>
                        <div className={styles.liveTvTitle}>Chamando agora na TV</div>
                        <div className={styles.liveTvTicket} id="tv-code">{currentCall ? currentCall.code : '---'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }} id="tv-service">
                            {currentCall
                                ? `${currentCall.service || ''} (${currentCall.category || ''})`
                                : 'Aguardando chamadas...'}
                        </div>
                    </div>
                    <div className={styles.liveTvDesk} id="tv-desk">
                        Guichê {currentCall ? padDesk(currentCall.desk, '01') : '--'}
                    </div>
                </section>

                {/* AVISOS INSTITUCIONAIS */}
                <section className={styles.infoCard}>
                    <strong style={{ color: '#1E293B', display: 'block', marginBottom: 4 }}>ℹ️ Dicas de Atendimento:</strong>
                    • Tenha em mãos seus documentos originais com foto.<br />
                    • Fique atento aos chamados de voz no salão de espera.
                </section>
            </main>
        </>
    );
}
