import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';

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
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    options?: {
      folder?: string;
      transformations?: TransformationOptions;
    },
  ): Promise<UploadApiResponse> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    if (!file.buffer) {
      throw new BadRequestException(
        'Invalid file provided. File buffer is missing.',
      );
    }

    const folder = options?.folder || 'uploads';

    const transformation = options?.transformations || [];

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream =
        this.cloudinaryClient.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
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
                new InternalServerErrorException(
                  `Cloudinary upload failed: ${error.message}`,
                ),
              );
            }

            if (!result) {
              this.logger.error(
                'Cloudinary returned no upload result.',
              );

              return reject(
                new InternalServerErrorException(
                  'Cloudinary returned no upload result.',
                ),
              );
            }

            resolve(result);
          },
        );

      const readable = Readable.from(file.buffer);

      readable.on('error', (error) => {
        this.logger.error(
          `File stream failed: ${error.message}`,
          error.stack,
        );

        reject(
          new InternalServerErrorException(
            'File streaming failed.',
          ),
        );
      });

      readable.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    if (!publicId) {
      throw new BadRequestException(
        'Cloudinary public ID is required.',
      );
    }

    try {
      const result =
        await this.cloudinaryClient.uploader.destroy(publicId);

      if (result.result === 'not found') {
        this.logger.warn(
          `Cloudinary asset not found: ${publicId}`,
        );

        return;
      }

      if (result.result !== 'ok') {
        throw new Error(
          `Cloudinary returned status: ${result.result}`,
        );
      }

      this.logger.log(
        `Cloudinary asset deleted: ${publicId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Cloudinary delete failed: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Failed to delete file from Cloudinary.',
      );
    }
  }

  async generateUploadSignature(
    folder = 'uploads',
  ) {
    const timestamp = Math.round(Date.now() / 1000);

    const apiSecret =
      process.env.CLOUDINARY_API_SECRET;

    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME;

    const apiKey =
      process.env.CLOUDINARY_API_KEY;

    if (!apiSecret || !cloudName || !apiKey) {
      throw new InternalServerErrorException(
        'Cloudinary configuration is missing.',
      );
    }

    const signature =
      this.cloudinaryClient.utils.api_sign_request(
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

  async uploadFromUrl(
    url: string,
    options?: {
      folder?: string;
      transformations?: TransformationOptions;
    },
  ): Promise<UploadApiResponse> {
    if (!url) {
      throw new BadRequestException(
        'URL is required.',
      );
    }

    const folder = options?.folder || 'uploads';

    const transformation =
      options?.transformations || [];

    try {
      return await this.cloudinaryClient.uploader.upload(
        url,
        {
          folder,
          resource_type: 'image',
          transformation,
        },
      );
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