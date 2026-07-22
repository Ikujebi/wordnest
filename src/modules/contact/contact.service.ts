import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

import { Prisma, Role } from '@prisma/client';
import { ContactRepository } from './contact.repository';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create contact message & notify admins
   */
  async create(data: Prisma.ContactMessageCreateInput) {
    try {
      const contact = await this.contactRepository.create(data);

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
   * Find all contact messages
   */
  async findAll(options?: any) {
    try {
      return await this.contactRepository.findAll(options);
    } catch (error) {
      this.logger.error('Failed fetching contact messages', error);
      throw new InternalServerErrorException(
        'Unable to fetch contact messages',
      );
    }
  }

  /**
   * Fetch latest contact messages for dashboard widgets
   */
  async latest(limit = 5) {
    try {
      return await this.contactRepository.findAll({
        limit,
        page: 1,
      });
    } catch (error) {
      this.logger.error('Failed fetching latest contact messages', error);
      throw new InternalServerErrorException(
        'Unable to fetch latest contact messages',
      );
    }
  }

  /**
   * Find single contact message
   */
  async findOne(id: string) {
    const contact = await this.contactRepository.findById(id);

    if (!contact) {
      throw new NotFoundException('Contact message not found');
    }

    return contact;
  }

  /**
   * Mark message as read
   */
  async markAsRead(id: string) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    try {
      return await this.contactRepository.update(id, { isRead: true });
    } catch (error) {
      this.logger.error(`Failed marking contact ${id} as read`, error);
      throw new InternalServerErrorException('Unable to mark contact as read');
    }
  }

  /**
   * Update contact message
   */
  async update(id: string, data: Prisma.ContactMessageUpdateInput) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    try {
      return await this.contactRepository.update(id, data);
    } catch (error) {
      this.logger.error(`Failed updating contact ${id}`, error);
      throw new InternalServerErrorException(
        'Unable to update contact message',
      );
    }
  }

  /**
   * Assign contact message to an admin/user
   */
  async assign(id: string, assignedToId: string) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    try {
      return await this.contactRepository.update(id, {
        assignedTo: { connect: { id: assignedToId } },
      });
    } catch (error) {
      this.logger.error(`Failed assigning contact ${id}`, error);
      throw new InternalServerErrorException('Unable to assign contact message');
    }
  }

/**
 * Resolve contact message
 */
async resolve(id: string, assignedToId?: string) {
  const exists = await this.contactRepository.exists(id);

  if (!exists) {
    throw new NotFoundException('Contact message not found');
  }

  return this.contactRepository.resolve(id, assignedToId);
}
  /**
   * Reopen/unresolve contact message
   */
  async unresolve(id: string) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    return this.contactRepository.unresolve(id);
  }

  /**
   * Soft delete contact message
   */
  async remove(id: string) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    return this.contactRepository.softDelete(id);
  }

  /**
   * Permanently purge contact message from DB (Super Admin only)
   */
  async deletePermanent(id: string) {
    try {
      return await this.contactRepository.deletePermanent(id);
    } catch (error) {
      this.logger.error(`Failed permanently deleting contact ${id}`, error);
      throw new InternalServerErrorException(
        'Unable to permanently delete contact',
      );
    }
  }

  /**
   * Restore deleted contact
   */
  async restore(id: string) {
    try {
      return await this.contactRepository.restore(id);
    } catch (error) {
      this.logger.error(`Failed restoring contact ${id}`, error);
      throw new InternalServerErrorException('Unable to restore contact');
    }
  }

  /**
   * Contact statistics
   */
  async statistics() {
    try {
      return await this.contactRepository.statistics();
    } catch (error) {
      this.logger.error('Failed getting contact statistics', error);
      throw new InternalServerErrorException('Unable to fetch statistics');
    }
  }

/**
 * Bulk resolve contacts
 */
async bulkResolve(ids: string[], assignedToId?: string) {
  if (!ids || !ids.length) {
    throw new BadRequestException('No contact IDs provided');
  }

  return this.contactRepository.bulkResolve(ids, assignedToId);
}

  /**
   * Bulk soft delete contacts
   */
  async bulkDelete(ids: string[]) {
    if (!ids || !ids.length) {
      throw new BadRequestException('No contact IDs provided');
    }

    return this.contactRepository.bulkDelete(ids);
  }

  /**
   * Bulk restore contacts
   */
  async bulkRestore(ids: string[]) {
    if (!ids || !ids.length) {
      throw new BadRequestException('No contact IDs provided');
    }

    try {
      return await this.contactRepository.bulkRestore(ids);
    } catch (error) {
      this.logger.error('Failed bulk restoring contacts', error);
      throw new InternalServerErrorException('Unable to bulk restore contacts');
    }
  }

  /**
   * Private helper to notify active admins
   */
  private async notifyAdmins(contact: any) {
    try {
      const admins = await this.getAdmins();

      if (!admins.length) {
        this.logger.warn('No administrators found for contact notification');
        return;
      }

      const userIds = admins.map((admin) => admin.id);
      const subjectText = contact.subject ? `\nSubject:\n${contact.subject}\n` : '';

      await this.notificationService.notifyMany(
        userIds,
        'New Contact Message',
        `New message received from ${contact.fullName || 'a visitor'}.${subjectText}\nEmail: ${contact.email}\n\nPlease review from the admin dashboard.`,
        'SYSTEM' as any,
      );
    } catch (error) {
      this.logger.error('Failed notifying administrators', error);
    }
  }

  /**
   * Get admin users
   */
  private async getAdmins() {
    return this.contactRepository['prisma'].user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
  }
}