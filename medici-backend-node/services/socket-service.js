/**
 * Socket.IO Service - Real-time Push Notifications
 * Handles WebSocket connections and broadcasts events to connected clients
 */

const logger = require('../config/logger');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 * @returns {SocketIO.Server} Socket.IO server instance
 */
function initialize(server) {
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [
            'https://medici-web03012026.vercel.app',
            'https://admin.medicihotels.com',
            'https://medici-web.vercel.app',
            'https://medici-frontend.vercel.app'
          ]
        : '*',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`, { reason });
    });

    socket.on('error', (error) => {
      logger.error(`[Socket.IO] Socket error: ${socket.id}`, { error: error.message });
    });
  });

  logger.info('[Socket.IO] Server initialized');
  return io;
}

/**
 * Emit event to all connected clients
 * @param {string} event - Event name
 * @param {object} data - Event data payload
 */
function emit(event, data) {
  if (io) {
    const payload = {
      ...data,
      timestamp: new Date().toISOString()
    };
    io.emit(event, payload);
    logger.info(`[Socket.IO] Emitted event: ${event}`, {
      event,
      clientCount: io.engine?.clientsCount || 'unknown'
    });
  } else {
    logger.warn(`[Socket.IO] Cannot emit - server not initialized`, { event });
  }
}

/**
 * Get connected client count
 * @returns {number} Number of connected clients
 */
function getClientCount() {
  return io?.engine?.clientsCount || 0;
}

/**
 * Check if Socket.IO is initialized
 * @returns {boolean} True if initialized
 */
function isInitialized() {
  return io !== null;
}

module.exports = {
  initialize,
  emit,
  getClientCount,
  isInitialized
};
