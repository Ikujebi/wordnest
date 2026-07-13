import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UploadApiResponse,
  UploadApiErrorResponse,
  v2 as cloudinary,
  TransformationOptions,
} from 'cloudinary';
import { Readable } from 'stream';
import { CLOUDINARY_PROVIDER_TOKEN } from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY_PROVIDER_TOKEN)
    private readonly cloudinaryClient: typeof cloudinary,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 1. STREAM UPLOAD (MULTER BACKEND UPLOAD)
   * Highly customizable for avatars, banners, and general media attachments.
   */
  async uploadFile(
    file: Express.Multer.File,
    options?: { folder?: string; transformations?: TransformationOptions },
  ): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file provided. Buffer missing.');
    }

    const folder = options?.folder || 'uploads';
    const transformation = options?.transformations || [];

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = this.cloudinaryClient.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          transformation,
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            this.logger.error(
              `Cloudinary upload failed: ${error.message}`,
              error.stack,
            );
            return reject(
              new InternalServerErrorException('File upload failed.'),
            );
          }

          if (!result) {
            return reject(
              new InternalServerErrorException('Cloudinary returned no result.'),
            );
          }

          resolve(result);
        },
      );

      // FIXED: Stream configuration is now placed inside the promise body context loop 
      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);

      readable.on('error', (err) => {
        this.logger.error(`Stream parsing error: ${err.message}`);
        reject(new InternalServerErrorException('File streaming failed.'));
      });

      readable.pipe(uploadStream);
    });
  }

  /**
   * 2. DELETE FILE
   * Safely deletes existing media assets when records are removed or swapped out.
   */
  async deleteFile(publicId: string): Promise<void> {
    if (!publicId) {
      throw new BadRequestException('publicId is required.');
    }

    try {
      const result = await this.cloudinaryClient.uploader.destroy(publicId);

      if (result.result === 'not found') {
        this.logger.warn(`Cloudinary asset not found for cleanup: ${publicId}`);
        return;
      }

      if (result.result !== 'ok') {
        throw new Error(`Cloudinary returned status: ${result.result}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Cloudinary delete failed for ${publicId}: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Failed to delete file from Cloudinary.',
      );
    }
  }

  /**
   * 3. SIGNED UPLOAD (SECURE DIRECT FRONTEND UPLOAD)
   * Offloads server bandwidth by creating short-lived upload permissions for the client app.
   */
  async generateUploadSignature(folder = 'uploads') {
    const timestamp = Math.round(Date.now() / 1000);

    const apiSecret = this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET');
    const cloudName = this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.getOrThrow<string>('CLOUDINARY_API_KEY');

    const signature = this.cloudinaryClient.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      apiSecret,
    );

    return {
      timestamp,
      signature,
      cloudName,
      apiKey,
      folder,
    };
  }

  /**
   * 4. UPLOAD FROM URL
   * Great for third-party integrations, social login avatars, or remote link cloning.
   */
  async uploadFromUrl(
    url: string,
    options?: { folder?: string; transformations?: TransformationOptions },
  ): Promise<UploadApiResponse> {
    if (!url) {
      throw new BadRequestException('URL is required.');
    }

    const folder = options?.folder || 'uploads';
    const transformation = options?.transformations || [];

    try {
      return await this.cloudinaryClient.uploader.upload(url, {
        folder,
        resource_type: 'auto',
        transformation,
      });
    } catch (error: any) {
      this.logger.error(
        `Cloudinary URL upload failed: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Failed to upload image from URL.',
      );
    }
  }
}