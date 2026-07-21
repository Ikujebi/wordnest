import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  /**
   * When user connects
   */
  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;

    if (!userId) {
      this.logger.warn(
        `Socket ${client.id} connected without userId`,
      );
      return;
    }

    client.join(this.userRoom(userId));

    this.logger.log(
      `User ${userId} connected through socket ${client.id}`,
    );
  }

  /**
   * When user disconnects
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  /**
   * Manually join user room
   */
  @SubscribeMessage('notification:join')
  joinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    client.join(this.userRoom(data.userId));

    client.emit('notification:joined', {
      success: true,
    });
  }

  /**
   * Send notification/event to one user
   * (Supports single payload or custom event + payload)
   */
  sendToUser(userId: string, eventOrPayload: any, payload?: any) {
    const event = payload ? eventOrPayload : 'notification:new';
    const data = payload ?? eventOrPayload;

    this.server.to(this.userRoom(userId)).emit(event, data);
  }

  /**
   * Alias for backward compatibility
   */
  emitToUser(userId: string, event: string, payload: any) {
    this.sendToUser(userId, event, payload);
  }

  /**
   * Send notification to everyone (broadcast)
   */
  broadcast(eventOrPayload: any, payload?: any) {
    const event = payload ? eventOrPayload : 'notification:system';
    const data = payload ?? eventOrPayload;

    this.server.emit(event, data);
  }

  /**
   * Send notification to system channel
   */
  emitGlobalNotification(payload: any) {
    this.broadcast('notification:system', payload);
  }

  /**
   * Send notification to admins
   */
  emitToAdmins(payload: any) {
    this.server.to('admins').emit('notification:admin', payload);
  }

  /**
   * Ping/Pong health check
   */
  @SubscribeMessage('notification:ping')
  ping(@ConnectedSocket() client: Socket) {
    client.emit('notification:pong', {
      timestamp: new Date(),
    });
  }

  /**
   * Notify unread count change
   */
  emitUnreadCount(userId: string, count: number) {
    this.sendToUser(userId, 'notification:unread-count', { count });
  }

  /**
   * Create private room name
   */
  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}