import { getLocalIp } from '@/lib/server/network';
import { PORT } from '@/lib/server/config';

export const dynamic = 'force-dynamic';

// Endereço de acesso pela rede local (usado no QR Code do totem)
export function GET() {
    const ip = getLocalIp();
    return Response.json({ ip, port: PORT, networkUrl: `http://${ip}:${PORT}` });
}
