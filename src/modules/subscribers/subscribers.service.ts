import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class SubscribersService {
  private readonly logger = new Logger(SubscribersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.subscriber.findUnique({ where: { email } });

    if (existing) {
      if (existing.isActive) {
        // Don't leak "already subscribed" as an error — just confirm success either way.
        return { message: 'You are already subscribed to our blog updates.' };
      }

      // Re-subscribing after a prior unsubscribe — reactivate the same
      // record so the stable unsubscribeToken carries over, rather than
      // creating a duplicate (email is @unique, so a duplicate would fail anyway).
      await this.prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          unsubscribedAt: null,
          firstName: dto.firstName ?? existing.firstName,
          lastName: dto.lastName ?? existing.lastName,
        },
      });

      return { message: 'Welcome back! You have been resubscribed to our blog updates.' };
    }

    try {
      await this.prisma.subscriber.create({
        data: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          receiveEmail: true,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create subscriber', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not process your subscription. Please try again.');
    }

    return { message: 'Thank you for subscribing! You will receive our latest blog updates by email.' };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
    if (!subscriber) throw new NotFoundException('Invalid or expired unsubscribe link.');
    if (!subscriber.isActive) return { message: 'You have already been unsubscribed.' };

    await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false, unsubscribedAt: new Date() },
    });

    return { message: 'You have been successfully unsubscribed.' };
  }
}