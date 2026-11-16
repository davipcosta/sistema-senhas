'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { SERVICES, useServerState, formatDesk } from '@/lib/client/store';
import { useWeather } from './useWeather';
import { useAnnouncer, formatarSenhaParaVoz } from './useAnnouncer';
import styles from './painel.module.css';

const CATEGORY_LABELS = { IDOSO: 'Idoso (80+)', PRIORIDADE: 'Prioridade' };
const CALL_CLASSES = { IDOSO: styles.callIdoso, PRIORIDADE: styles.callPrio };
const ITEM_CLASSES = { IDOSO: styles.itemIdoso, PRIORIDADE: styles.itemPrio };

const cx = (...names) => names.filter(Boolean).join(' ');

const callId = (call) => `${call.code}_${formatDesk(call.desk)}_${call.calledAt || ''}_${call.recalledAt || ''}`;

export default function Painel() {
    const state = useServerState();
    const [sector, setSector] = useState(SERVICES[0]);
    const [pulseKey, setPulseKey] = useState(0);
    const weather = useWeather();
    const falarChamada = useAnnouncer();
    const lastSpokenId = useRef(undefined);

    // A TV não rola a página
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    const history = state?.history || [];
    const filteredHistory = sector === 'ALL' ? history : history.filter(item => item.service === sector);
    const call = filteredHistory[0] || null;
    const currentId = call ? callId(call) : null;

    // Anuncia (gongo + voz) sempre que a chamada exibida muda.
    // Na primeira carga do estado só memoriza a chamada, sem anunciar.
    useEffect(() => {
        if (!state) return;
        if (lastSpokenId.current === undefined) {
            lastSpokenId.current = currentId;
            return;
        }
        if (!call || currentId === lastSpokenId.current) return;

        lastSpokenId.current = currentId;
        setPulseKey(k => k + 1);
        falarChamada(`Senha ${formatarSenhaParaVoz(call.code)}. Guichê ${formatDesk(call.desk)}.`);
    }, [state, currentId]); // eslint-disable-line react-hooks/exhaustive-deps

    const historyItems = filteredHistory.slice(1, 6);
    const categoriaTexto = call ? (CATEGORY_LABELS[call.category] || 'Atendimento Geral') : '';

    return (
        <>
            <Topbar>
                {/* Seletor de Setores para a TV */}
                <div className={styles.panelSectorSelector}>
                    {SERVICES.map(s => (
                        <button
                            key={s}
                            type="button"
                            className={cx(styles.panelSectorBtn, s === sector && styles.active)}
                            onClick={() => setSector(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </Topbar>

            <main className={styles.mainContainerPanel}>
                <section
                    key={pulseKey}
                    id="main-call-box"
                    className={cx(styles.currentCallBox, (call && CALL_CLASSES[call.category]) || styles.callNormal, pulseKey && styles.pulseAnimation)}
                >
                    <div>
                        <div>
                            <div className={styles.labelTitle}>Senha de Atendimento</div>
                            <div className={styles.ticketNumber} id="current-ticket">{call ? call.code : '---'}</div>
                            <div className={styles.ticketCategoryBadge} id="current-category">
                                {call
                                    ? (call.service ? `${categoriaTexto} • ${call.service}` : categoriaTexto)
                                    : (sector === 'ALL' ? 'Aguardando Chamada' : `Aguardando chamada para ${sector}`)}
                            </div>
                        </div>
                    </div>
                    <div className={styles.deskContainer}>
                        <div className={styles.labelTitle}>Local de Atendimento</div>
                        <div className={styles.deskNumber} id="current-desk">
                            Guichê {call ? formatDesk(call.desk) : '--'}
                        </div>
                    </div>
                </section>

                <aside className={styles.historyBox}>
                    <div className={styles.historyTitle}>Últimas Chamadas</div>
                    <div className={styles.historyHeader}>
                        <span>SENHA / SERVIÇO</span>
                        <span>GUICHÊ</span>
                    </div>
                    <div className="history-list" id="history-list">
                        {historyItems.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', padding: 18, textAlign: 'center', fontWeight: 600, background: 'var(--bg-main)', borderRadius: 14 }}>
                                {sector === 'ALL' ? 'Aguardando chamadas...' : `Nenhuma chamada recente para ${sector}`}
                            </div>
                        ) : historyItems.map(item => (
                            <div key={item.code} className={cx(styles.historyItem, ITEM_CLASSES[item.category])}>
                                <div>
                                    <div className={styles.ticketCode}>{item.code}</div>
                                    <small style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginTop: 2 }}>
                                        {item.service || ''} • {item.category || ''}
                                    </small>
                                </div>
                                <span className={styles.deskCode}>Guichê {formatDesk(item.desk)}</span>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>

            {/* Rodapé de Avisos e Notícias Institucionais da DPE-PA */}
            <footer className={styles.panelTickerFooter}>
                <div className={styles.tickerLabel}>INFORMATIVO DPE-PA</div>
                <div className={styles.tickerContentWrapper}>
                    <div className={styles.tickerText}>
                        <span id="weather-ticker-item">🌤️ <strong>Clima em Belém:</strong> <span className={styles.weatherHighlight} id="weather-info">{weather}</span></span>
                        <span>🏛️ <strong>Defensoria Pública do Estado do Pará:</strong> Garantindo assistência jurídica gratuita e defesa dos seus direitos.</span>
                        <span>🕒 <strong>Horário de Atendimento:</strong> Segunda a Sexta-feira, das 08h às 14h.</span>
                        <span>📄 <strong>Documentos Importantes:</strong> Tenha em mãos RG, CPF, Comprovante de Residência e Renda.</span>
                        <span>🤫 <strong>Silêncio:</strong> Por favor, mantenha aparelhos celulares no modo silencioso.</span>
                        <span>♿ <strong>Atendimento Prioritário:</strong> Idosos (80+), gestantes, pessoas com deficiência e lactantes.</span>
                    </div>
                </div>
            </footer>
        </>
    );
}
