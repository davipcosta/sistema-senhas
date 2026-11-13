// Tempo real: WebSocket nativo (ws) e Socket.IO no mesmo servidor HTTP
const { WebSocketServer, WebSocket } = require('ws');
const { Server } = require('socket.io');
const { state, commit, events } = require('./state');
const queue = require('./queue');

function attachRealtime(server) {
    const wss = new WebSocketServer({ noServer: true });
    const io = new Server(server, { cors: { origin: '*' } });

    // O Socket.IO trata o próprio upgrade em /socket.io; o resto vai para o ws
    server.on('upgrade', (request, socket, head) => {
        try {
            const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
            if (url.pathname.startsWith('/socket.io')) {
                return;
            }
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } catch (err) {
            socket.destroy();
        }
    });

    // Toda mudança de estado é enviada para todos os clientes
    events.on('change', (current) => {
        const payload = JSON.stringify({ type: 'stateUpdate', data: current });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(payload);
                } catch (err) {
                    console.error('Erro ao enviar mensagem WebSocket:', err);
                }
            }
        });
        io.emit('stateUpdate', current);
    });

    wss.on('connection', (ws) => {
        const reply = (type, data) => ws.send(JSON.stringify({ type, data }));
        reply('stateUpdate', state);

        ws.on('message', async (messageData) => {
            try {
                const message = JSON.parse(messageData.toString());
                const actionType = message.type || message.action;
                const payload = message.payload || message.data || message;

                switch (actionType) {
                    case 'GET_STATE':
                    case 'getState':
                        reply('stateUpdate', state);
                        break;

                    case 'NEW_TICKET':
                    case 'newTicket': {
                        const ticket = queue.createTicket({
                            service: payload.service,
                            category: payload.category,
                            prefix: payload.prefix || 'ATD'
                        });
                        reply('ticketCreated', ticket);
                        break;
                    }

                    case 'CALL_TICKET':
                    case 'callTicket':
                        try {
                            reply('ticketCalled', await queue.callNext(payload.desk, payload.serviceFilter || 'ALL'));
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', error: err.message }));
                        }
                        break;

                    case 'RECALL_TICKET':
                    case 'recallTicket':
                        try {
                            reply('ticketRecalled', await queue.recall(payload.code, payload.desk));
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', error: err.message }));
                        }
                        break;

                    case 'RESET_SYSTEM':
                    case 'resetSystem':
                        queue.reset();
                        reply('systemReset', { success: true });
                        break;

                    case 'ping':
                        ws.send(JSON.stringify({ type: 'pong' }));
                        break;

                    default:
                        commit();
                }
            } catch (err) {
                console.error('[WebSocket] Erro ao processar mensagem:', err);
            }
        });
    });

    io.on('connection', (socket) => {
        socket.emit('stateUpdate', state);
        socket.on('newTicket', () => commit());
        socket.on('callTicket', () => commit());
        socket.on('resetSystem', () => commit());
    });
}

module.exports = { attachRealtime };
