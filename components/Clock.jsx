'use client';

import { useEffect, useState } from 'react';
import styles from './Clock.module.css';

// Relógio do topo. Começa com placeholder para não divergir da renderização no servidor.
export default function Clock() {
    const [now, setNow] = useState(null);

    useEffect(() => {
        setNow(new Date());
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className={styles.clockContainer}>
            <span id="clock-time" className={styles.clockBadge}>
                {now ? now.toLocaleTimeString('pt-BR') : '00:00:00'}
            </span>
            <span id="clock-date">{now ? now.toLocaleDateString('pt-BR') : '00/00/0000'}</span>
        </div>
    );
}
