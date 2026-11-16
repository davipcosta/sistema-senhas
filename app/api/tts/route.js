import fs from 'fs';
import { getSpeechFile } from '@/lib/server/tts';

export const dynamic = 'force-dynamic';

// Voz TTS padronizada
export async function GET(request) {
    try {
        const text = (request.nextUrl.searchParams.get('text') || '').trim();
        if (!text) return new Response('Texto não fornecido', { status: 400 });

        const filePath = await getSpeechFile(text);
        const audio = await fs.promises.readFile(filePath);
        return new Response(audio, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(audio.length)
            }
        });
    } catch (error) {
        console.error('Erro ao gerar TTS:', error.message || error);
        return Response.json({ error: 'Erro ao sintetizar áudio.' }, { status: 500 });
    }
}
