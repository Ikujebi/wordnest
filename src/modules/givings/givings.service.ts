import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Giving, Prisma, NotificationType } from '@prisma/client';
import { RecordGivingDto } from './dto/record-giving.dto';
import { UpdateGivingDto } from './dto/update-giving.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';

@Injectable()
export class GivingsService {
  private readonly logger = new Logger(GivingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Helper to retrieve a giving record or throw NotFoundException.
   */
  private async findGivingOrThrow(id: string): Promise<Giving> {
    const giving = await this.prisma.giving.findFirst({
      where: { id, deletedAt: null },
    });

    if (!giving) {
      throw new NotFoundException(`Giving record with ID "${id}" not found.`);
    }

    return giving;
  }

  /**
   * Commits a financial transaction to the ledger with strict integrity safeguards.
   */
  async recordTransaction(
    dto: RecordGivingDto,
    userId?: string,
  ): Promise<Giving> {
    let giving: Giving;

    try {
      giving = await this.prisma.giving.create({
        data: {
          type: dto.type,
          amount: new Prisma.Decimal(dto.amount),
          reference: dto.reference || null,
          paymentMethod: dto.paymentMethod || null,
          notes: dto.notes || null,
          memberId: dto.memberId || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'A financial transaction with this reference hash already exists.',
          );
        }
        if (error.code === 'P2003') {
          throw new NotFoundException(
            'The specified Member record associated with this ledger entry does not exist.',
          );
        }
      }

      this.logger.error(
        'Failed to log giving entry',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred finalizing the financial ledger record.',
      );
    }

    // 1. Notify the member if linked to a user account
    if (giving.memberId) {
      const member = await this.prisma.member.findUnique({
        where: { id: giving.memberId },
        select: { userId: true },
      });

      if (member?.userId) {
        await this.notificationService.create({
          userId: member.userId,
          title: 'Giving Received',
          message: `Your ${giving.type.toLowerCase().replace('_', ' ')} has been successfully recorded. Thank you for your generosity.`,
          type: NotificationType.SYSTEM,
        });
      }
    }

    // 2. Notify Admins
    await this.notificationService.notifyAdmins({
      title: 'New Giving Recorded',
      message: `A ${giving.type.toLowerCase().replace('_', ' ')} has been recorded.`,
      type: NotificationType.SYSTEM,
    });

    // 3. Create Audit Log
    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.RECORD_GIVING,
        entity: 'Giving',
        entityId: giving.id,
        description: `Recorded ${giving.type}`,
        newValues: giving,
      },
    );

    return giving;
  }

  /**
   * Updates an existing giving record.
   */
  async updateGiving(
    id: string,
    dto: UpdateGivingDto,
    userId?: string,
  ): Promise<Giving> {
    const oldValues = await this.findGivingOrThrow(id);

    try {
      const updated = await this.prisma.giving.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.amount && { amount: new Prisma.Decimal(dto.amount) }),
        },
      });

      await this.auditLogService.createLog(
        { id: userId ?? undefined },
        {
          action: AuditAction.UPDATE_GIVING,
          entity: 'Giving',
          entityId: updated.id,
          description: `Updated giving entry: ${updated.id}`,
          oldValues,
          newValues: updated,
        },
      );

      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update giving entry with ID ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the giving record.',
      );
    }
  }

  /**
   * Soft deletes a giving ledger entry.
   */
  async deleteGiving(id: string, userId?: string): Promise<Giving> {
    const giving = await this.findGivingOrThrow(id);

    const deleted = await this.prisma.giving.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.DELETE_GIVING,
        entity: 'Giving',
        entityId: giving.id,
        description: `Soft deleted giving entry: ${giving.id}`,
        oldValues: giving,
        newValues: deleted,
      },
    );

    return deleted;
  }

  /**
   * Processes a giving refund, notifies the user, and logs the action.
   */
  async refundGiving(id: string, userId?: string): Promise<Giving> {
    const oldValues = await this.findGivingOrThrow(id);

    // Soft delete or flag as refunded depending on your model schema
    const refunded = await this.prisma.giving.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Notify user if member account is linked
    if (refunded.memberId) {
      const member = await this.prisma.member.findUnique({
        where: { id: refunded.memberId },
        select: { userId: true },
      });

      if (member?.userId) {
        await this.notificationService.create({
          userId: member.userId,
          title: 'Giving Refunded',
          message: 'Your giving transaction has been refunded.',
          type: NotificationType.SYSTEM,
        });
      }
    }

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.REFUND_GIVING,
        entity: 'Giving',
        entityId: refunded.id,
        description: `Refunded giving transaction: ${refunded.id}`,
        oldValues,
        newValues: refunded,
      },
    );

    return refunded;
  }

  /**
   * Compiles total contributions grouped by giving categories.
   */
  async getFinancialMetrics(userId?: string) {
    let metrics: Array<{ category: string; totalAllocated: string }>;

    try {
      const aggregations = await this.prisma.giving.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _sum: {
          amount: true,
        },
      });

      metrics = aggregations.map((item) => ({
        category: item.type,
        totalAllocated: item._sum.amount?.toString() || '0.00',
      }));
    } catch (error) {
      this.logger.error(
        'Failed to aggregate ledger data',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Could not retrieve financial data summaries.',
      );
    }

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.VIEW_GIVING_REPORT,
        entity: 'Giving',
        description: 'Viewed giving financial summary',
      },
    );

    return metrics;
  }
}