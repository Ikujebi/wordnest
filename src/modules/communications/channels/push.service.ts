import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

export interface PushResult {
  success: boolean;
  error?: string;
  isExpired?: boolean; // If true, the browser subscription has expired/revoked, delete from DB
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    
    // 1. Grab the raw value from environment fallbacks
    const rawContact = process.env.VAPID_SUBJECT || process.env.EMAIL_FROM || 'mailto:admin@wordtabernacle.org.ng';
    let contactEmail = rawContact;

    // 2. Extract clean email if it's wrapped in a "Friendly Name <email@address.com>" format
    const emailMatch = rawContact.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      contactEmail = emailMatch[1];
    }

    // 3. Ensure it has a valid URL prefix (mailto: or http/https) required by web-push helper validation
    if (!contactEmail.startsWith('mailto:') && !contactEmail.startsWith('http://') && !contactEmail.startsWith('https://')) {
      contactEmail = `mailto:${contactEmail}`;
    }

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys missing. Web Push notification service running in simulation mode.');
      return;
    }

    try {
      // Set details once globally for the web-push module
      webpush.setVapidDetails(contactEmail, publicKey, privateKey);
      this.logger.log(`Web Push VAPID configurations loaded successfully with subject: ${contactEmail}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize Web Push VAPID: ${error.message}`);
    }
  }

  /**
   * Dispatches a push notification directly to the user's browser subscription context
   */
  async send(subscription: WebPushSubscription, payload: WebPushPayload): Promise<PushResult> {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      this.logger.log(`[SIMULATED WEB PUSH] Title: "${payload.title}" | Body: "${payload.body}"`);
      return { success: true };
    }

    try {
      const stringifiedPayload = JSON.stringify({
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon.png',
          badge: payload.badge || '/badge.png',
          data: payload.data,
        }
      });

      await webpush.sendNotification(subscription as any, stringifiedPayload);
      return { success: true };

    } catch (error: any) {
      this.logger.error(`Web Push delivery failed: ${error.message}`);

      // GCM/FCM/Mozilla endpoint returns 410 Gone or 404 Not Found if user cleared browser cookies or revoked permissions
      const isExpired = error.statusCode === 410 || error.statusCode === 404;

      return {
        success: false,
        error: error.message,
        isExpired,
      };
    }
  }
}