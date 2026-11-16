import { state } from '@/lib/server/state';

export const dynamic = 'force-dynamic';

// Estado completo
export function GET() {
    return Response.json(state);
}
