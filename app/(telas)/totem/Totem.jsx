'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Topbar from '@/components/Topbar';
import Badge from '@/components/Badge';
import { generateTicket } from '@/lib/client/store';
import styles from './totem.module.css';

const SERVICE_OPTIONS = [
    { value: 'Vara Criminal', icon: '⚖️', hint: 'Processos criminais e defesa' },
    { value: 'Família', icon: '👨‍👩‍👧‍👦', hint: 'Pensão, guarda, divórcio' },
    { value: 'Execução Penal', icon: '📑', hint: 'Cumprimento de penas e benefícios' }
];

const CATEGORY_OPTIONS = [
    { value: 'NORMAL', icon: '👤', label: 'Normal', hint: 'Atendimento geral' },
    { value: 'PRIORIDADE', icon: '♿', label: 'Prioridade Legal', hint: 'Gestantes, lactantes, PCD, 60+' },
    { value: 'IDOSO', icon: '🧓', label: 'Idoso (80+)', hint: 'Prioridade especial por lei' }
];

const BADGE_LABELS = { IDOSO: 'IDOSO (80+)', PRIORIDADE: 'PRIORIDADE', NORMAL: 'NORMAL' };
const RESET_AFTER_MS = 10000;
const hintStyle = { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 };

export default function Totem() {
    const [step, setStep] = useState('service'); // service → category → ticket
    const [service, setService] = useState('');
    const [category, setCategory] = useState('NORMAL');
    const [ticket, setTicket] = useState(null);
    const [qrSrc, setQrSrc] = useState('');
    const [clientUrl, setClientUrl] = useState('#');
    const serverInfo = useRef(null);
    const resetTimer = useRef(null);

    // IP da rede local fornecido pelo servidor (para o QR Code)
    useEffect(() => {
        fetch('/api/info')
            .then(res => (res.ok ? res.json() : null))
            .then(info => { serverInfo.current = info; })
            .catch(e => console.warn('Não foi possível obter informações de rede do servidor:', e));
        return () => clearTimeout(resetTimer.current);
    }, []);

    function getBaseUrlForClient() {
        const info = serverInfo.current;
        // Se o totem foi aberto via localhost, usa o IP da rede local para que o celular consiga acessar
        if (info && info.networkUrl && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            return info.networkUrl;
        }
        return window.location.origin;
    }

    function resetFlow() {
        clearTimeout(resetTimer.current);
        setService('');
        setCategory('NORMAL');
        setTicket(null);
        setStep('service');
    }

    async function confirmAndGenerate() {
        const created = await generateTicket(service, category);
        if (!created) return;

        // QR Code com URL alcançável pelo celular na rede local (Wi-Fi)
        const url = `${getBaseUrlForClient()}/cliente?ticket=${encodeURIComponent(created.code)}`;
        try {
            setQrSrc(await QRCode.toDataURL(url, {
                width: 120,
                margin: 0,
                errorCorrectionLevel: 'M',
                color: { dark: '#004825', light: '#ffffff' }
            }));
        } catch (e) {
            console.warn('Erro ao gerar QR Code localmente, usando fallback:', e);
            setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`);
        }

        setClientUrl(url);
        setTicket(created);
        setStep('ticket');
        resetTimer.current = setTimeout(resetFlow, RESET_AFTER_MS);
    }

    return (
        <>
            <Topbar active="/totem" />
            <main className="main-container-form">
                {step === 'service' && (
                    <section id="step-1">
                        <div className="header-title">
                            <span className="eyebrow">Passo 1 de 2</span>
                            <h1>Selecione o Serviço Desejado</h1>
                        </div>
                        <div className="card">
                            <div className="options-grid">
                                {SERVICE_OPTIONS.map(opt => (
                                    <div
                                        key={opt.value}
                                        className="option-btn"
                                        onClick={() => { setService(opt.value); setStep('category'); }}
                                    >
                                        <span style={{ fontSize: '1.8rem' }}>{opt.icon}</span>
                                        <span>{opt.value}</span>
                                        <small style={hintStyle}>{opt.hint}</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {step === 'category' && (
                    <section id="step-2">
                        <div className="header-title">
                            <span className="eyebrow">Passo 2 de 2</span>
                            <h1>Tipo de Atendimento</h1>
                        </div>
                        <div className="card">
                            <div className="options-grid" id="category-options">
                                {CATEGORY_OPTIONS.map(opt => (
                                    <div
                                        key={opt.value}
                                        className={`option-btn${category === opt.value ? ' selected' : ''}`}
                                        onClick={() => setCategory(opt.value)}
                                    >
                                        <span style={{ fontSize: '1.8rem' }}>{opt.icon}</span>
                                        <span>{opt.label}</span>
                                        <small style={hintStyle}>{opt.hint}</small>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
                                <button style={{ flex: 1 }} onClick={resetFlow}>
                                    VOLTAR
                                </button>
                                <button className={styles.btnSubmit} style={{ flex: 2 }} onClick={confirmAndGenerate}>
                                    EMITIR SENHA
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {step === 'ticket' && ticket && (
                    <section id="step-ticket">
                        <div className={styles.ticketStub} style={{ margin: '0 auto' }}>
                            <img src="/images/dpepa.svg" alt="DPE-PA" className={styles.stubHeaderLogo} />
                            <div className={styles.stubEyebrow}>Sua Senha de Atendimento</div>
                            <div className={styles.stubCode} id="modal-ticket-code">{ticket.code}</div>
                            <div className={styles.perforation}></div>
                            <div className={styles.stubService} id="modal-service">{ticket.service}</div>
                            <div id="modal-badge">
                                {BADGE_LABELS[ticket.category] && (
                                    <Badge
                                        category={ticket.category}
                                        label={BADGE_LABELS[ticket.category]}
                                        style={{ display: 'inline-block', marginTop: 8 }}
                                    />
                                )}
                            </div>

                            {/* QR Code para Acompanhamento no Celular */}
                            <div style={{ marginTop: 16 }}>
                                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 14, display: 'inline-block' }}>
                                    {qrSrc && (
                                        <img
                                            id="ticket-qrcode"
                                            src={qrSrc}
                                            alt="QR Code Celular"
                                            style={{ display: 'block', width: 120, height: 120, margin: '0 auto' }}
                                        />
                                    )}
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 6 }}>
                                        📱 Aponte a câmera para acompanhar
                                    </div>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <a
                                        id="link-cliente-direto"
                                        href={clientUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ fontSize: '0.82rem', color: 'var(--dpe-green)', fontWeight: 700, textDecoration: 'underline' }}
                                    >
                                        Abrir acompanhamento no navegador ↗
                                    </a>
                                </div>
                            </div>

                            <p className={styles.stubFooter}>Por favor, retire sua senha e aguarde a chamada no painel de TV.</p>
                        </div>

                        <button
                            className={styles.btnSubmit}
                            style={{ marginTop: 24, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', display: 'block' }}
                            onClick={resetFlow}
                        >
                            CONCLUIR / NOVO ATENDIMENTO
                        </button>
                    </section>
                )}
            </main>
        </>
    );
}
