import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

// Using a clear exported token prevents string typos when using @Inject()
export const CLOUDINARY_PROVIDER_TOKEN = 'CLOUDINARY_CLIENT';

export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY_PROVIDER_TOKEN,
  inject: [ConfigService], // Inject Nest's ConfigService dynamically
  useFactory: (configService: ConfigService) => {
    return cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  },
};