// Utilitários comuns aos Route Handlers de /api
export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

export function errorResponse(error, fallbackMessage) {
    const status = error.statusCode || 500;
    return Response.json({ error: error.message || fallbackMessage }, { status });
}
