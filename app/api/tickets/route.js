import queue from '@/lib/server/queue';
import { readJson } from '../_utils';

// Gerar senha
export async function POST(request) {
    const { service, category, prefix = 'ATD' } = await readJson(request);
    return Response.json(queue.createTicket({ service, category, prefix }));
}
