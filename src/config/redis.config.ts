import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const RedisQueueModule = BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const host = configService.get<string>('REDIS_HOST');
    const port = configService.get<number>('REDIS_PORT', 17262);
    const password = configService.get<string>('REDIS_PASSWORD');

    // Automatically fix the eviction policy on startup
    try {
      const client = new Redis({ host, port, password });
      await client.config('SET', 'maxmemory-policy', 'noeviction');
      client.disconnect(); // Clean up temporary client connection
    } catch (err) {
      // If the Redis provider restricts runtime configuration updates, catch it safely
    }

    return {
      connection: {
        host,
        port,
        password,
      },
    };
  },
});