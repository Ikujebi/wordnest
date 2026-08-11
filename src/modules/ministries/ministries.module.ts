import { Module } from "@nestjs/common";
import { MinistriesService } from "./ministries.service";
import { MinistriesController } from "./ministries.controller";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notification.module";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditLogModule,
  ],

  controllers: [
    MinistriesController,
  ],

  providers: [
    MinistriesService,
  ],

  exports: [
    MinistriesService,
  ],
})
export class MinistriesModule {}

