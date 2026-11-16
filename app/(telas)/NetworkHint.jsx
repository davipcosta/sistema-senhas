'use client';

import { useEffect, useState } from 'react';
import styles from './NetworkHint.module.css';

export default function NetworkHint() {
    const [networkUrl, setNetworkUrl] = useState(null);

    useEffect(() => {
        fetch('/api/info')
            .then(res => (res.ok ? res.json() : null))
            .then(info => info && info.networkUrl && setNetworkUrl(info.networkUrl))
            .catch(() => {});
    }, []);

    if (!networkUrl) return null;
    return (
        <p className={styles.networkHint} id="network-hint">
            Acesso pela rede local: <code id="network-url">{networkUrl}</code>
        </p>
    );
}
