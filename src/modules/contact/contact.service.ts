import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role, NotificationType, ContactMessage } from '@prisma/client';
import { ContactRepository, ContactQueryOptions } from './contact.repository';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new contact message (Public API)
   */
  async create(data: Prisma.ContactMessageCreateInput): Promise<ContactMessage> {
    try {
      const contact = await this.contactRepository.create(data);

      // Dispatch non-blocking admin notification
      await this.notifyAdmins(contact);

      return contact;
    } catch (error) {
      this.logger.error('Failed creating contact message', error);
      throw new InternalServerErrorException(
        'Unable to submit contact message',
      );
    }
  }

  /**
   * Fetch contacts with filters and pagination
   */
  async findAll(query: ContactQueryOptions = {}) {
    return this.contactRepository.findAll(query);
  }

  /**
   * Fetch single contact by ID
   */
  async findOne(id: string): Promise<ContactMessage> {
    const contact = await this.contactRepository.findById(id);

    if (!contact) {
      throw new NotFoundException('Contact message not found');
    }

    return contact;
  }

  /**
   * Mark message as read
   */
  async markAsRead(id: string): Promise<ContactMessage> {
    await this.findOne(id);
    return this.contactRepository.markAsRead(id);
  }

  /**
   * Resolve contact message with assigned handler
   */
  async resolve(id: string, assignedToId: string): Promise<ContactMessage> {
    await this.findOne(id);
    return this.contactRepository.resolve(id, assignedToId);
  }

  /**
   * Unresolve contact message
   */
  async unresolve(id: string): Promise<ContactMessage> {
    await this.findOne(id);
    return this.contactRepository.unresolve(id);
  }

  /**
   * Update contact fields
   */
  async update(
    id: string,
    data: Prisma.ContactMessageUpdateInput,
  ): Promise<ContactMessage> {
    await this.findOne(id);
    return this.contactRepository.update(id, data);
  }

  /**
   * Soft delete contact
   */
  async remove(id: string): Promise<ContactMessage> {
    await this.findOne(id);
    return this.contactRepository.softDelete(id);
  }

  /**
   * Restore soft-deleted contact
   */
  async restore(id: string): Promise<ContactMessage> {
    return this.contactRepository.restore(id);
  }

  /**
   * Permanently purge contact record
   */
  async deletePermanent(id: string): Promise<ContactMessage> {
    await this.findOne(id);
    return this.contactRepository.deletePermanent(id);
  }

  /**
   * Bulk resolve contact messages
   */
  async bulkResolve(ids: string[], assignedToId: string) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No contact IDs supplied');
    }
    return this.contactRepository.bulkResolve(ids, assignedToId);
  }

  /**
   * Bulk soft-delete contact messages
   */
  async bulkDelete(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No contact IDs supplied');
    }
    return this.contactRepository.bulkDelete(ids);
  }

  /**
   * Bulk restore contact messages
   */
  async bulkRestore(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No contact IDs supplied');
    }
    return this.contactRepository.bulkRestore(ids);
  }

  /**
   * Dashboard statistics
   */
  async statistics() {
    return this.contactRepository.statistics();
  }

  /**
   * Get latest submissions widget data
   */
  async latest(limit = 5) {
    return this.contactRepository.latest(limit);
  }

  /**
   * Notify administrators about incoming public messages
   */
  private async notifyAdmins(contact: ContactMessage): Promise<void> {
    try {
      // Inject PrismaService directly instead of reaching into repository private properties
      const users = await this.prisma.user.findMany({
        where: {
          role: {
            in: [Role.ADMIN, Role.SUPER_ADMIN],
          },
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!users.length) {
        return;
      }

      await this.notificationService.createForUsers(
        users.map((user) => user.id),
        {
          title: 'New Contact Message Received',
          message: `${contact.fullName} sent a new message: ${contact.subject}`,
          type: NotificationType.SYSTEM,
        },
      );
    } catch (error) {
      // Non-blocking warning on notification failure
      this.logger.warn(
        `Unable to notify administrators for contact message ${contact.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}