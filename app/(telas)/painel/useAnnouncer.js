'use client';

import { useCallback, useEffect, useRef } from 'react';

// "CRIM-001" → "C R I M, 0 0 1" (soletrado pelo TTS)
export function formatarSenhaParaVoz(codigo) {
    if (!codigo) return '';
    const partes = codigo.split('-');
    if (partes.length === 2) {
        return `${partes[0].split('').join(' ')}, ${partes[1].split('').join(' ')}`;
    }
    return codigo.split('').join(' ');
}

function tone(ctx, frequency, start, end, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
}

// Gongo (Web Audio) seguido da voz (/api/tts). Os navegadores bloqueiam som
// automático: o primeiro clique/toque/tecla na tela libera o áudio.
export function useAnnouncer() {
    const audioPlayer = useRef(null);
    const audioContext = useRef(null);

    useEffect(() => {
        audioPlayer.current = new Audio();
        const unlock = () => {
            if (audioContext.current && audioContext.current.state === 'suspended') {
                audioContext.current.resume();
            }
        };
        const events = ['click', 'keydown', 'touchstart'];
        events.forEach(e => window.addEventListener(e, unlock));
        return () => {
            events.forEach(e => window.removeEventListener(e, unlock));
            audioPlayer.current.pause();
            if (audioContext.current) audioContext.current.close();
        };
    }, []);

    const tocarGongo = useCallback(() => new Promise((resolve) => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return resolve();
            if (!audioContext.current) audioContext.current = new AudioCtx();
            const ctx = audioContext.current;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            tone(ctx, 698.46, now, now + 0.55, 0.28);
            tone(ctx, 523.25, now + 0.22, now + 0.85, 0.32);
            setTimeout(resolve, 800);
        } catch (e) {
            console.warn('Não foi possível tocar o gongo:', e);
            resolve();
        }
    }), []);

    return useCallback(async (texto) => {
        try {
            await tocarGongo();
            const player = audioPlayer.current;
            if (!player) return;
            player.pause();
            player.currentTime = 0;
            player.src = `/api/tts?text=${encodeURIComponent(texto)}`;
            await player.play();
        } catch (e) {
            console.warn('Áudio aguardando interação inicial do usuário:', e);
        }
    }, [tocarGongo]);
}
