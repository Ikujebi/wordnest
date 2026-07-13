export interface SendEmailOptions {
  communicationId?: string;
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export type TemplateType = 'WELCOME' | 'PASSWORD_RESET' | 'COMMUNITY_NOTIFICATION';

export interface WelcomeTemplateData {
  name: string;
  actionUrl: string;
}

export interface PasswordResetTemplateData {
  name: string;
  resetUrl: string;
}

export interface GenericNotificationTemplateData {
  title: string;
  body: string;
  actionText?: string;
  actionUrl?: string;
}

export interface EmailTemplatePayload {
  WELCOME: WelcomeTemplateData;
  PASSWORD_RESET: PasswordResetTemplateData;
  COMMUNITY_NOTIFICATION: GenericNotificationTemplateData;
}