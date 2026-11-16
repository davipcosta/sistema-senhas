import Link from 'next/link';
import Clock from './Clock';
import styles from './Topbar.module.css';

const NAV = [
    { href: '/totem', label: 'Totem' },
    { href: '/guiche', label: 'Guichê' },
    { href: '/painel', label: 'Painel' }
];

// Cabeçalho comum às telas. `children` substitui a navegação (ex.: seletor de setor do painel).
export default function Topbar({ active, children }) {
    return (
        <header className={styles.topbar}>
            <div className={styles.brandContainer}>
                <img src="/images/dpepa.svg" alt="Logo DPE-PA" className={styles.brandLogo} />
                <div className={styles.brandTitle}>
                    Defensoria Pública
                    <span>Estado do Pará</span>
                </div>
            </div>
            {children || (
                <nav className={styles.topnavLinks}>
                    {NAV.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={active === item.href ? `${styles.navLink} ${styles.active}` : styles.navLink}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            )}
            <Clock />
        </header>
    );
}
