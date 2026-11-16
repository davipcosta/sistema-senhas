import queue from '@/lib/server/queue';
import { readJson, errorResponse } from '../_utils';

// Rechamar
export async function POST(request) {
    try {
        const { code, desk } = await readJson(request);
        return Response.json(await queue.recall(code, desk));
    } catch (error) {
        return errorResponse(error, 'Erro ao rechamar.');
    }
}
