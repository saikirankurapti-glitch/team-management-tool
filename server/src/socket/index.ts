import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export const initSocketServer = (httpServer: HTTPServer, clientOrigin: string) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const onlineUsers = new Map<string, { socketId: string; status: 'ONLINE' | 'AWAY' | 'OFFLINE' }>();

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('user_online', (data: { userId: string }) => {
      if (data?.userId) {
        onlineUsers.set(data.userId, { socketId: socket.id, status: 'ONLINE' });
        io.emit('presence_change', { userId: data.userId, status: 'ONLINE' });
      }
    });

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      console.log(`[Socket.io] Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
    });

    socket.on('typing_start', (data: { roomId: string; userId: string; fullName: string }) => {
      socket.to(data.roomId).emit('user_typing', { userId: data.userId, fullName: data.fullName, isTyping: true });
    });

    socket.on('typing_stop', (data: { roomId: string; userId: string }) => {
      socket.to(data.roomId).emit('user_typing', { userId: data.userId, isTyping: false });
    });

    socket.on('send_message', (data: { roomId: string; message: any }) => {
      io.to(data.roomId).emit('new_message', data.message);
    });

    socket.on('edit_message', (data: { roomId: string; message: any }) => {
      io.to(data.roomId).emit('message_edited', data.message);
    });

    socket.on('delete_message', (data: { roomId: string; messageId: string }) => {
      io.to(data.roomId).emit('message_deleted', { messageId: data.messageId });
    });

    socket.on('toggle_reaction', (data: { roomId: string; reactionData: any }) => {
      io.to(data.roomId).emit('reaction_updated', data.reactionData);
    });

    socket.on('disconnect', () => {
      for (const [userId, info] of onlineUsers.entries()) {
        if (info.socketId === socket.id) {
          onlineUsers.delete(userId);
          io.emit('presence_change', { userId, status: 'OFFLINE' });
          break;
        }
      }
    });
  });

  return io;
};
