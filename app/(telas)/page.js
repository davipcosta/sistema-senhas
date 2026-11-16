import Link from 'next/link';
import Topbar from '@/components/Topbar';
import NetworkHint from './NetworkHint';
import styles from './page.module.css';

const SCREENS = [
    { href: '/totem', icon: '🎫', label: 'Totem', hint: 'Emissão de senhas para o público' },
    { href: '/guiche', icon: '🧑‍💼', label: 'Guichê', hint: 'Chamar e rechamar senhas' },
    { href: '/painel', icon: '📺', label: 'Painel', hint: 'TV da sala de espera com voz' },
    { href: '/cliente', icon: '📱', label: 'Acompanhar senha', hint: 'Ver a posição na fila pelo celular' }
];

export default function HomePage() {
    return (
        <>
            <Topbar />
            <main className="main-container-form">
                <section>
                    <div className="header-title">
                        <span className="eyebrow">Sistema de Senhas</span>
                        <h1>Escolha a tela deste dispositivo</h1>
                    </div>

                    <div className="card">
                        <div className="options-grid">
                            {SCREENS.map(screen => (
                                <Link key={screen.href} className={`option-btn ${styles.optionLink}`} href={screen.href}>
                                    <span style={{ fontSize: '1.8rem' }}>{screen.icon}</span>
                                    <span>{screen.label}</span>
                                    <small style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                        {screen.hint}
                                    </small>
                                </Link>
                            ))}
                        </div>
                        <NetworkHint />
                    </div>
                </section>
            </main>
        </>
    );
}
