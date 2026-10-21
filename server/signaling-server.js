import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { roomId, type } = data;

      if (type === 'join_room') {
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        const room = rooms.get(roomId);
        room.add(ws);
        ws.roomId = roomId;

        console.log(`[Room ${roomId}] Peer joined. Total peers: ${room.size}`);

        // If another peer is already waiting in the room, notify them to start calling!
        if (room.size > 1) {
          room.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify({ type: 'user_joined' }));
            }
          });
        }
      } else {
        // Forward SDP Offer, Answer, or ICE candidate to the other peer(s)
        const room = rooms.get(roomId);
        if (room) {
          room.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(message.toString());
            }
          });
        }
      }
    } catch (err) {
      console.error('Signaling error:', err);
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      room.delete(ws);
      room.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'user_left' }));
        }
      });
      if (room.size === 0) rooms.delete(ws.roomId);
    }
  });
});

console.log(`Signaling server listening on ws://localhost:${PORT}`);
