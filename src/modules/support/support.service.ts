import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ContactMessage, MediaGallery, Prisma } from '@prisma/client';
import { SubmitMessageDto } from './dto/submit-message.dto';
import { ResolveMessageDto } from './dto/resolve-message.dto';
import { AttachMediaDto } from './dto/attach-media.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Captures an unauthenticated inbound messaging request directly from the landing web forms.
   */
  async recordInboundMessage(dto: SubmitMessageDto): Promise<ContactMessage> {
    try {
      return await this.prisma.contactMessage.create({
        data: dto,
      });
    } catch (error) {
      this.logger.error('Failed processing inbound visitor support ticket', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not submit inquiry ticket.');
    }
  }

  /**
   * Updates resolution status metrics and flags the corporate management team assignment details.
   */
  async updateMessageResolution(id: string, dto: ResolveMessageDto): Promise<ContactMessage> {
    try {
      return await this.prisma.contactMessage.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Inquiry ticket entry match not found.');
      }
      this.logger.error(`Failed editing resolution state profiles on ticket instance: ${id}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Roster compilation update failed execution.');
    }
  }

  /**
   * Indexes cloud-uploaded media objects safely to attach them into contextual operational schemas.
   */
  async catalogMediaAsset(dto: AttachMediaDto, uploaderId: string): Promise<MediaGallery> {
    try {
      return await this.prisma.mediaGallery.create({
        data: {
          ...dto,
          uploadedById: uploaderId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('The chosen Event relationship context reference ID does not exist.');
      }
      this.logger.error('Failed to link cloud storage asset metadata profiles', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Asset framework database indexing failure.');
    }
  }
}