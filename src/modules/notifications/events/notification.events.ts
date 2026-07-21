export const NotificationEvents = {

  /**
   * Fired when a new notification is created
   */
  CREATED: 'notification:new',


  /**
   * Fired when notification is opened/read
   */
  READ: 'notification:read',


  /**
   * Fired when notification is deleted
   */
  DELETED: 'notification:deleted',


  /**
   * Fired when unread count changes
   */
  UNREAD_COUNT:
    'notification:unread-count',


  /**
   * System-wide notifications
   */
  SYSTEM:
    'notification:system',


  /**
   * Admin-only notifications
   */
  ADMIN:
    'notification:admin',


  /**
   * Socket connection confirmation
   */
  JOINED:
    'notification:joined',


  /**
   * Health check
   */
  PONG:
    'notification:pong',

} as const;



/**
 * Type helper
 *
 * Allows:
 *
 * NotificationEventType
 *
 * instead of manually typing strings
 */
export type NotificationEventType =
  typeof NotificationEvents[
    keyof typeof NotificationEvents
  ];