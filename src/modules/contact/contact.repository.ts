import { Injectable } from '@nestjs/common';
import { Prisma, ContactMessage, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ContactQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  resolved?: boolean;
  read?: boolean;
  assignedToId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeDeleted?: boolean;
  orderBy?: Prisma.ContactMessageOrderByWithRelationInput;
}

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch admin users by roles for notification dispatch
   */
  async findAdmins(roles: Role[] = [Role.ADMIN, Role.SUPER_ADMIN]) {
    return this.prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
  }

  /**
   * Create contact message
   */
  async create(
    data: Prisma.ContactMessageCreateInput,
  ): Promise<ContactMessage> {
    return this.prisma.contactMessage.create({
      data,
    });
  }

  /**
   * Fetch contacts with pagination
   */
  async findAll(options: ContactQueryOptions = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      resolved,
      read,
      assignedToId,
      fromDate,
      toDate,
      includeDeleted = false,
      orderBy = { createdAt: 'desc' },
    } = options;

    const where: Prisma.ContactMessageWhereInput = {
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(resolved !== undefined && { isResolved: resolved }),
      ...(read !== undefined && { isRead: read }),
      ...(assignedToId && { assignedToId }),

      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ],
      }),

      ...((fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Find single contact by ID
   */
  async findById(id: string): Promise<ContactMessage | null> {
    return this.prisma.contactMessage.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(id: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Resolve contact and assign handler (if provided)
   */
  async resolve(id: string, assignedToId?: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        ...(assignedToId && { assignedToId }),
      },
    });
  }

  /**
   * Unresolve contact
   */
  async unresolve(id: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: {
        isResolved: false,
        resolvedAt: null,
        assignedToId: null,
      },
    });
  }

  /**
   * Generic update
   */
  async update(id: string, data: Prisma.ContactMessageUpdateInput) {
    return this.prisma.contactMessage.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete
   */
  async softDelete(id: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore deleted contact
   */
  async restore(id: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Permanent delete
   */
  async deletePermanent(id: string) {
    return this.prisma.contactMessage.delete({
      where: { id },
    });
  }

  /**
   * Check existence of active (non-deleted) record
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.contactMessage.count({
      where: {
        id,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  /**
   * Dashboard Statistics
   */
  async statistics() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, resolved, unresolved, unread, today, deleted] =
      await this.prisma.$transaction([
        this.prisma.contactMessage.count({ where: { deletedAt: null } }),
        this.prisma.contactMessage.count({
          where: { deletedAt: null, isResolved: true },
        }),
        this.prisma.contactMessage.count({
          where: { deletedAt: null, isResolved: false },
        }),
        this.prisma.contactMessage.count({
          where: { deletedAt: null, isRead: false },
        }),
        this.prisma.contactMessage.count({
          where: {
            deletedAt: null,
            createdAt: { gte: startOfToday },
          },
        }),
        this.prisma.contactMessage.count({
          where: { deletedAt: { not: null } },
        }),
      ]);

    return {
      total,
      resolved,
      unresolved,
      unread,
      today,
      deleted,
    };
  }

  /**
   * Fetch recent messages for dashboard widgets
   */
  async latest(limit = 5) {
    return this.prisma.contactMessage.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Bulk resolve contacts
   */
  async bulkResolve(ids: string[], assignedToId?: string) {
    return this.prisma.contactMessage.updateMany({
      where: { id: { in: ids } },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        ...(assignedToId && { assignedToId }),
      },
    });
  }

  /**
   * Bulk soft delete
   */
  async bulkDelete(ids: string[]) {
    return this.prisma.contactMessage.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Bulk restore
   */
  async bulkRestore(ids: string[]) {
    return this.prisma.contactMessage.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
  }
}