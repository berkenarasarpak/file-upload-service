import WebSocket from 'ws';
import http from 'http';
import { progressTracker } from './redis';
import logger from './logger';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const clientId = this.extractClientId(req);
      this.clients.set(clientId, ws);

      logger.info('WebSocket client connected', { clientId });

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'subscribe' && data.fileId) {
            // Send current progress immediately
            const progress = await progressTracker.getProgress(data.fileId);
            if (progress) {
              ws.send(JSON.stringify({
                type: 'progress',
                data: progress
              }));
            }
          }
        } catch (error) {
          logger.error('WebSocket message error', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { clientId, error });
      });

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId
      }));
    });
  }

  private extractClientId(req: http.IncomingMessage): string {
    const url = new URL(req.url || '', 'http://localhost');
    return url.searchParams.get('clientId') || `client-${Date.now()}`;
  }

  broadcastProgress(fileId: string, progress: any): void {
    const message = JSON.stringify({
      type: 'progress',
      data: progress
    });

    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  sendToClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
}
