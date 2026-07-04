import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class AuthPasswordService {
  private readonly logger = new Logger(AuthPasswordService.name);

  // OWASP Recommended baseline parameters for Argon2id
  private readonly hashingOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB of memory RAM usage
    timeCost: 3,       // number of passes through memory
    parallelism: 4,    // number of computing threads to bind
  };

  /**
   * Generates a secure, computationally expensive Argon2id cryptographic fingerprint string.
   */
  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, this.hashingOptions);
  }

  /**
   * Validates a password against an existing cryptographic signature.
   */
  async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      if (!hash || !plainText) {
        return false;
      }

      // Argon2 automatically extracts parameter metrics out of the hashed string profile
      return await argon2.verify(hash, plainText);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Password verification error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Unknown password verification error occurred.');
      }

      return false;
    }
  }
}