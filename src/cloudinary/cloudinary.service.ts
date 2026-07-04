import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  UploadApiResponse,
  UploadApiErrorResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Invalid file provided. Buffer is missing.',
      );
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            this.logger.error(error.message, error.stack);
            return reject(error);
          }

          if (!result) {
            return reject(
              new Error('Cloudinary returned no upload result.'),
            );
          }

          resolve(result);
        },
      );

      const readable = new Readable();

      readable.push(file.buffer);
      readable.push(null);

      readable.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId);

    if (
      result.result !== 'ok' &&
      result.result !== 'not found'
    ) {
      throw new Error('Unable to delete image from Cloudinary.');
    }
  }
}