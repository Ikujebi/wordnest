import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY_PROVIDER_TOKEN = 'CLOUDINARY_CLIENT';

export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY_PROVIDER_TOKEN,
  inject: [ConfigService],

  useFactory: (configService: ConfigService) => {
    cloudinary.config({
      cloud_name: configService.getOrThrow<string>(
        'CLOUDINARY_CLOUD_NAME',
      ),
      api_key: configService.getOrThrow<string>(
        'CLOUDINARY_API_KEY',
      ),
      api_secret: configService.getOrThrow<string>(
        'CLOUDINARY_API_SECRET',
      ),
    });

    // IMPORTANT:
    // Return the actual Cloudinary client,
    // not the result of cloudinary.config()
    return cloudinary;
  },
};