import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);

  /**
   * Hash text (passwords, tokens) using Argon2id.
   */
  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, {
      type: argon2.argon2id,
    });
  }

  /**
   * Verify plain text against an Argon2 hash.
   * Safely handles malformed hashes by returning false.
   */
  async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      if (!hash || !plainText) {
        return false;
      }

      return await argon2.verify(hash, plainText);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Cryptographic verification failed: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Cryptographic verification failed.');
      }

      return false;
    }
  }

  /**
   * Generate a cryptographically secure random token.
   */
  generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}