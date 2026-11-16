import queue from '@/lib/server/queue';
import { readJson, errorResponse } from '../_utils';

// Chamar próximo
export async function POST(request) {
    try {
        const { desk, serviceFilter = 'ALL' } = await readJson(request);
        return Response.json(await queue.callNext(desk, serviceFilter));
    } catch (error) {
        return errorResponse(error, 'Erro ao chamar próximo.');
    }
}
