import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    // Run aggregates in parallel for optimal database speed
    const [totalMembers, activeWorkers, monthlyGivingSum] = await Promise.all([
      // Count all active records in the member table (excluding soft-deleted ones)
      this.prisma.member.count({
        where: { deletedAt: null }
      }),

      // Count only members flagged as workers who are active
      this.prisma.member.count({
        where: { 
          isWorker: true,
          deletedAt: null
        },
      }),

      // Sum transaction values for the current calendar month
      this.prisma.giving.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
          deletedAt: null // Exclude soft-deleted financial records
        },
      }),
    ]);

    // Safe optional chaining and safe numeric parsing from Prisma Decimal to Number
    const monthlyGiving = monthlyGivingSum?._sum?.amount 
      ? Number(monthlyGivingSum._sum.amount) 
      : 0;

    return {
      totalMembers,
      activeWorkers,
      monthlyGiving,
      growthRate: 0, 
    };
  }

  async getRecentProvisionings() {
    // Corrected to use 'entity' and 'entityId' since your schema doesn't have a 'target' field
    return this.prisma.auditLog.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true, 
        user: {
          select: {
            fullName: true // Highly useful to show WHO performed the action in the audit feed
          }
        }
      },
    });
  }
}