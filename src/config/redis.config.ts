import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const RedisQueueModule = BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    connection: {
      host: configService.get<string>('REDIS_HOST'),
      port: configService.get<number>('REDIS_PORT', 17262), // Enforces conversion to a number safely
      password: configService.get<string>('REDIS_PASSWORD'),
    },
  }),
});