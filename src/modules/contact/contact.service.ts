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
import { AuditLogService } from '../audit-log/audit-log.service'; // Adjust path as needed
import { AuditAction } from '../audit-log/enums/audit-action.enum'; // Adjust path as needed

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
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
      const updated = await this.contactRepository.update(id, data);

      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.UPDATE,
          entity: 'ContactMessage',
          entityId: id,
          description: `Updated contact message from ${updated.fullName || updated.email}`,
          newValues: updated,
        },
      );

      return updated;
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
      const updated = await this.contactRepository.update(id, {
        assignedTo: { connect: { id: assignedToId } },
      });

      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.ASSIGN_CONTACT_MESSAGE,
          entity: 'ContactMessage',
          entityId: id,
          description: `Assigned contact message from "${updated.fullName || updated.email}" to admin user ${assignedToId}`,
          newValues: { assignedToId },
        },
      );

      return updated;
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

    const resolved = await this.contactRepository.resolve(id, assignedToId);

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.RESOLVE_CONTACT_MESSAGE,
        entity: 'ContactMessage',
        entityId: id,
        description: `Resolved contact message ${id}`,
        newValues: { status: 'RESOLVED', assignedToId },
      },
    );

    return resolved;
  }

  /**
   * Reopen/unresolve contact message
   */
  async unresolve(id: string) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    const unresolved = await this.contactRepository.unresolve(id);

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.UPDATE,
        entity: 'ContactMessage',
        entityId: id,
        description: `Reopened/unresolved contact message ${id}`,
        newValues: { status: 'OPEN' },
      },
    );

    return unresolved;
  }

  /**
   * Soft delete contact message
   */
  async remove(id: string) {
    const exists = await this.contactRepository.exists(id);

    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    const deleted = await this.contactRepository.softDelete(id);

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.DELETE,
        entity: 'ContactMessage',
        entityId: id,
        description: `Soft deleted contact message ${id}`,
      },
    );

    return deleted;
  }

  /**
   * Permanently purge contact message from DB (Super Admin only)
   */
  async deletePermanent(id: string) {
    try {
      const result = await this.contactRepository.deletePermanent(id);

      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.DELETE,
          entity: 'ContactMessage',
          entityId: id,
          description: `Permanently deleted contact message ${id}`,
        },
      );

      return result;
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
      const restored = await this.contactRepository.restore(id);

      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.UPDATE,
          entity: 'ContactMessage',
          entityId: id,
          description: `Restored soft-deleted contact message ${id}`,
        },
      );

      return restored;
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

    const result = await this.contactRepository.bulkResolve(ids, assignedToId);

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.RESOLVE_CONTACT_MESSAGE,
        entity: 'ContactMessage',
        description: `Bulk resolved ${ids.length} contact messages`,
        newValues: { ids, assignedToId },
      },
    );

    return result;
  }

  /**
   * Bulk soft delete contacts
   */
  async bulkDelete(ids: string[]) {
    if (!ids || !ids.length) {
      throw new BadRequestException('No contact IDs provided');
    }

    const result = await this.contactRepository.bulkDelete(ids);

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.DELETE,
        entity: 'ContactMessage',
        description: `Bulk soft-deleted ${ids.length} contact messages`,
        newValues: { ids },
      },
    );

    return result;
  }

  /**
   * Bulk restore contacts
   */
  async bulkRestore(ids: string[]) {
    if (!ids || !ids.length) {
      throw new BadRequestException('No contact IDs provided');
    }

    try {
      const result = await this.contactRepository.bulkRestore(ids);

      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.UPDATE,
          entity: 'ContactMessage',
          description: `Bulk restored ${ids.length} contact messages`,
          newValues: { ids },
        },
      );

      return result;
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