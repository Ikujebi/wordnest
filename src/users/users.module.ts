import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Adjust path to your global/shared Prisma module

@Module({
  imports: [
    PrismaModule, // Injecting Prisma to provide the underlying database access
  ],
  controllers: [
    UsersController,
  ],
  providers: [
    UsersService,
  ],
  exports: [
    UsersService, // Exported so AuthModule or AuditLogModule can look up users
  ],
})
export class UsersModule {}