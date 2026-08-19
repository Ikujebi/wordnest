import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { AuthTokenService } from './auth-token.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import * as crypto from 'crypto';

@Injectable()
export class AuthEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly tokenService: AuthTokenService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * World-class HTML template wrapper for consistent branding across transactional emails.
   */
  private buildEmailTemplate(options: {
    title: string;
    preheader: string;
    contentHtml: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.title}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #faf7f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Preheader text for inbox preview -->
        <div style="display: none; max-height: 0px; overflow: hidden;">${options.preheader}</div>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf7f2; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                
                <!-- Header / Branding -->
                <tr>
                  <td style="background-color: #5F021F; padding: 32px 40px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                      Word Tabernacle
                    </h1>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 40px; text-align: left;">
                    ${options.contentHtml}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #fcfbfa; padding: 24px 40px; border-top: 1px solid #f0edeb; text-align: center; font-size: 12px; color: #888888; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0;">This email was sent by <strong>Word Tabernacle Bible Church</strong>.</p>
                    <p style="margin: 0;">If you didn't create an account, please ignore this email or contact support.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async sendVerificationEmail(user: AuthenticatedUser): Promise<void> {
    const rawToken = this.tokenService.generateOpaqueToken();
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 Hours

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      }),
    ]);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://portal.wordtabernacle.org.ng';
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    const contentHtml = `
      <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Confirm your email address</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Hello <strong>${user.fullName}</strong>,<br><br>
        Welcome to Word Tabernacle! Please verify your email address to complete setting up your portal access.
      </p>
      
      <!-- CTA Button -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
        <tr>
          <td style="border-radius: 10px; background-color: #5F021F;">
            <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 10px;">
              Verify Email Address
            </a>
          </td>
        </tr>
      </table>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        This verification link will expire in <strong>24 hours</strong>.
      </p>
      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.4; margin: 0;">
        If button clicks don't work, copy and paste this URL into your browser:<br>
        <a href="${verificationUrl}" style="color: #5F021F; word-break: break-all;">${verificationUrl}</a>
      </p>
    `;

    const html = this.buildEmailTemplate({
      title: 'Verify your email address - Word Tabernacle',
      preheader: 'Please confirm your email address to activate your Word Tabernacle portal access.',
      contentHtml,
    });

    await this.emailService.sendEmail(
      user.email,
      'Verify your email address - Word Tabernacle',
      html,
    );
  }

  async sendPasswordResetEmail(user: any): Promise<void> {
    const rawToken = this.tokenService.generateOpaqueToken();
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 1); // 1 Hour

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      }),
    ]);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://portal.wordtabernacle.org.ng';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    const contentHtml = `
      <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Reset your password</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Hello <strong>${user.fullName}</strong>,<br><br>
        We received a request to reset your password for your Word Tabernacle portal account.
      </p>
      
      <!-- CTA Button -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
        <tr>
          <td style="border-radius: 10px; background-color: #5F021F;">
            <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 10px;">
              Reset Password
            </a>
          </td>
        </tr>
      </table>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.4; margin: 0;">
        Trouble clicking? Copy and paste this URL into your browser:<br>
        <a href="${resetUrl}" style="color: #5F021F; word-break: break-all;">${resetUrl}</a>
      </p>
    `;

    const html = this.buildEmailTemplate({
      title: 'Reset your password - Word Tabernacle',
      preheader: 'Use this link to securely reset your password for your Word Tabernacle portal account.',
      contentHtml,
    });

    await this.emailService.sendEmail(
      user.email,
      'Reset your password - Word Tabernacle',
      html,
    );
  }

  async validatePasswordResetToken(rawToken: string) {
    const hashedToken = this.hashToken(rawToken);

    return this.prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  async validateEmailVerificationToken(rawToken: string) {
    const hashedToken = this.hashToken(rawToken);

    return this.prisma.emailVerificationToken.findFirst({
      where: {
        token: hashedToken,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }
}