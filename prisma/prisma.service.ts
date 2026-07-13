import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
      }),
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    // Run the check as soon as the database connects successfully
    await this.seedSuperAdmin();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

 private async seedSuperAdmin() {
  try {
    const superAdminExists = await this.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (!superAdminExists) {
      console.log('⏳ No Super Admin found. Auto-generating root administrator...');

      const defaultPassword = 'Ayanfe123!';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      await this.user.create({
        data: {
          email: 'admin@wordtabernacle.org.ng',
          fullName: 'System Super Admin',
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          emailVerified: true,
        },
      });

      console.log(
        '🚀 Super Admin successfully created inside NestJS startup pipeline!',
      );
      console.log('👉 Email: admin@wordtabernacle.org.ng');
      console.log(`👉 Password: ${defaultPassword}`);
    } else {
      console.log('✅ Super Admin connection check passed (Account exists).');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        '❌ Failed to run Super Admin auto-seed check:',
        error.message,
      );
      console.error(error.stack);
    } else {
      console.error(
        '❌ Failed to run Super Admin auto-seed check:',
        error,
      );
    }
  }
}
}