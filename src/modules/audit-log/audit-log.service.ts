import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

import { QueryAuditDto } from './dto/audit-query.dto';
import { AuditMetadata } from './interfaces/audit.interface';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ==========================================
   * CREATE AUDIT LOG
   * ==========================================
   */

  async createLog(
    user: {
      id?: string;
      email?: string;
      role?: string;
    },
    metadata: AuditMetadata,
    request?: {
      ip?: string;
      method?: string;
      endpoint?: string;
      userAgent?: string;
    },
    response?: {
      statusCode?: number;
      success?: boolean;
    },
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: user.id,

        userEmail: user.email,

        userRole: user.role as any,

        action: metadata.action,

        description: metadata.description,

        entity: metadata.entity,

        entityId: metadata.entityId,

        method: request?.method,

        endpoint: request?.endpoint,

        ipAddress: request?.ip,

        userAgent: request?.userAgent,

        statusCode: response?.statusCode,

        success: response?.success ?? true,

        oldValues:
          metadata.oldValues as Prisma.InputJsonValue,

        newValues:
          metadata.newValues as Prisma.InputJsonValue,

        metadata:
          metadata.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * ==========================================
   * GET ALL LOGS
   * ==========================================
   */

  async findAll(
    query: QueryAuditDto,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entity) {
      where.entity = query.entity;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};

      if (query.startDate) {
        where.createdAt.gte = new Date(
          query.startDate,
        );
      }

      if (query.endDate) {
        where.createdAt.lte = new Date(
          query.endDate,
        );
      }
    }

    const [logs, total] =
      await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,

          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },

          skip: (page - 1) * limit,

          take: limit,
        }),

        this.prisma.auditLog.count({
          where,
        }),
      ]);

    return {
      data: logs,

      pagination: {
        total,

        page,

        limit,

        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ==========================================
   * GET ONE LOG
   * ==========================================
   */

  async findOne(id: string) {
    const log =
      await this.prisma.auditLog.findUnique({
        where: { id },

        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });

    if (!log) {
      throw new NotFoundException(
        'Audit log not found.',
      );
    }

    return log;
  }

  /**
   * ==========================================
   * USER HISTORY
   * ==========================================
   */

  async findUserHistory(
    userId: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * ==========================================
   * ENTITY HISTORY
   * ==========================================
   */

  async findEntityHistory(
    entity: string,
    entityId: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}