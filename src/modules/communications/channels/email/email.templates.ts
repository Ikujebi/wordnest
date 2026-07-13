import { EmailTemplatePayload } from './email.types';

export class EmailTemplates {
  private static wrapLayout(title: string, bodyContent: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f9f9f9; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #eaebed; }
            .header { margin-bottom: 30px; text-align: center; }
            .button { display: inline-block; padding: 12px 24px; margin: 20px 0; color: #ffffff !important; background-color: #0070f3; border-radius: 5px; text-decoration: none; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 12px; color: #888888; text-align: center; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            ${bodyContent}
            <div class="footer">
              <p>Sent by Word Tabernacle Community Platform</p>
              <p>If you did not expect this email, please safely ignore it.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  static render<T extends keyof EmailTemplatePayload>(
    template: T,
    data: EmailTemplatePayload[T]
  ): { subject: string; html: string } {
    switch (template) {
      case 'WELCOME': {
        const payload = data as EmailTemplatePayload['WELCOME'];
        const subject = 'Welcome to Word Tabernacle!';
        const html = this.wrapLayout(
          subject,
          `
          <div class="header"><h2>Welcome, ${payload.name}!</h2></div>
          <p>We are absolutely thrilled to welcome you to our community platform.</p>
          <p>Click the button below to complete your account setup and explore your personalized dashboard:</p>
          <p style="text-align: center;">
            <a href="${payload.actionUrl}" class="button" target="_blank">Get Started</a>
          </p>
          `
        );
        return { subject, html };
      }

      case 'PASSWORD_RESET': {
        const payload = data as EmailTemplatePayload['PASSWORD_RESET'];
        const subject = 'Reset Your Password';
        const html = this.wrapLayout(
          subject,
          `
          <div class="header"><h2>Password Reset Request</h2></div>
          <p>Hi ${payload.name},</p>
          <p>We received a request to change your password. Click the link below to set up a new one. This link will expire shortly:</p>
          <p style="text-align: center;">
            <a href="${payload.resetUrl}" class="button" target="_blank">Reset Password</a>
          </p>
          <p>If you didn't ask for this change, you don't need to do anything.</p>
          `
        );
        return { subject, html };
      }

      case 'COMMUNITY_NOTIFICATION': {
        const payload = data as EmailTemplatePayload['COMMUNITY_NOTIFICATION'];
        const subject = payload.title;
        let actionButton = '';
        
        if (payload.actionText && payload.actionUrl) {
          actionButton = `<p style="text-align: center;"><a href="${payload.actionUrl}" class="button" target="_blank">${payload.actionText}</a></p>`;
        }

        const html = this.wrapLayout(
          subject,
          `
          <div class="header"><h2>${payload.title}</h2></div>
          <p>${payload.body}</p>
          ${actionButton}
          `
        );
        return { subject, html };
      }

      default:
        throw new Error(`Template type "${template}" is unhandled.`);
    }
  }
}