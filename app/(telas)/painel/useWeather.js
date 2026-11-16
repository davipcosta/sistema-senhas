'use client';

import { useEffect, useState } from 'react';

// Previsão do tempo em Belém (Lat: -1.4558, Lon: -48.4902), atualizada a cada 15 minutos
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-1.4558&longitude=-48.4902&current=temperature_2m,relative_humidity_2m,weather_code&timezone=America%2FBelem';
const REFRESH_MS = 15 * 60 * 1000;

function describe(code) {
    if ([1, 2, 3].includes(code)) return ['Parcialmente Nublado', '🌤️'];
    if ([45, 48].includes(code)) return ['Névoa', '🌫️'];
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return ['Chuva / Pancadas', '🌧️'];
    if ([95, 96, 99].includes(code)) return ['Temporal com Trovoadas', '⛈️'];
    return ['Ensolarado', '☀️'];
}

export function useWeather() {
    const [text, setText] = useState('Carregando previsão...');

    useEffect(() => {
        async function fetchWeather() {
            try {
                const data = await (await fetch(WEATHER_URL)).json();
                if (data && data.current) {
                    const temp = Math.round(data.current.temperature_2m);
                    const humidity = data.current.relative_humidity_2m;
                    const [desc, icon] = describe(data.current.weather_code);
                    setText(`${icon} Belém ${temp}°C (${desc}) • Umidade: ${humidity}%`);
                }
            } catch (error) {
                console.warn('Não foi possível obter a previsão do tempo:', error);
                setText('☀️ Belém 31°C (Ensolarado)');
            }
        }
        fetchWeather();
        const timer = setInterval(fetchWeather, REFRESH_MS);
        return () => clearInterval(timer);
    }, []);

    return text;
}
