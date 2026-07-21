import { Module } from '@nestjs/common';

import { PrayerRequestsController } from './prayer-requests.controller';

import { PrayerRequestsService } from './prayer-requests.service';

import { PrayerCommunicationService } from './prayer-communication.service';

import { CommunicationsModule } from '../communications/communications.module';

import { PrismaService } from '../../../prisma/prisma.service';



@Module({

  imports: [
    CommunicationsModule,
  ],


  controllers: [
    PrayerRequestsController,
  ],


  providers: [

    PrayerRequestsService,

    PrayerCommunicationService,

    PrismaService,

  ],


  exports: [

    PrayerRequestsService,

    PrayerCommunicationService,

  ],


})
export class PrayerRequestsModule {}