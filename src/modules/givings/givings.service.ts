import { Injectable, ConflictException, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Giving, Prisma } from '../../../app/generated/prisma/client';
import { RecordGivingDto } from './dto/record-giving.dto';

@Injectable()
export class GivingsService {
  private readonly logger = new Logger(GivingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Commits a financial transaction to the ledger with strict integrity safeguards.
   */
  async recordTransaction(dto: RecordGivingDto): Promise<Giving> {
    try {
      return await this.prisma.giving.create({
        data: {
          type: dto.type,
          // Convert the safe input string explicitly to a Prisma compatible Decimal object
          amount: new Prisma.Decimal(dto.amount),
          reference: dto.reference || null,
          paymentMethod: dto.paymentMethod || null,
          notes: dto.notes || null,
          memberId: dto.memberId || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint failed (e.g., duplicated reference hash from transaction gateway webhook)
        if (error.code === 'P2002') {
          throw new ConflictException('A financial transaction with this reference hash already exists.');
        }
        // P2003: Foreign key constraint failure (e.g., matching member ID doesn't exist)
        if (error.code === 'P2003') {
          throw new NotFoundException('The specified Member record associated with this ledger entry does not exist.');
        }
      }

      this.logger.error('Failed to log giving entry', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An unexpected error occurred finalizing the financial ledger record.');
    }
  }

  /**
   * Compiles total contributions grouped by giving categories.
   */
  async getFinancialMetrics() {
    try {
      const aggregations = await this.prisma.giving.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _sum: {
          amount: true,
        },
      });

      return aggregations.map((item) => ({
        category: item.type,
        totalAllocated: item._sum.amount?.toString() || '0.00',
      }));
    } catch (error) {
      this.logger.error('Failed to aggregate ledger data', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not retrieve financial data summaries.');
    }
  }
}