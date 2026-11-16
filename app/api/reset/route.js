import queue from '@/lib/server/queue';

// Zerar
export function POST() {
    return Response.json(queue.reset());
}
