import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  //          GLOBAL DASHBOARD METHODS
  // ==========================================

  async getDashboardStats() {
    // Generate an absolute UTC start date for the current calendar month
    const now = new Date();
    const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const [totalMembers, activeWorkers, monthlyGivingSum] = await Promise.all([
      this.prisma.member.count({
        where: { deletedAt: null }
      }),

      this.prisma.member.count({
        where: { 
          isWorker: true,
          deletedAt: null
        },
      }),

      this.prisma.giving.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
          },
          deletedAt: null 
        },
      }),
    ]);

    // Securely cast the Prisma.Decimal object into a native standard JavaScript number
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
            fullName: true 
          }
        }
      },
    });
  }

  // ==========================================
  //         INDIVIDUAL TARGETING METHODS
  // ==========================================

  async targetIndividualUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            maritalStatus: true,
            isWorker: true,
            occupation: true,
            address: true
          }
        }
      }
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException(`User with ID ${userId} does not exist or has been removed.`);
    }

    return user;
  }

  async getIndividualsByRole(targetRole: Role) {
    return this.prisma.user.findMany({
      where: {
        role: targetRole,
        deletedAt: null 
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateIndividualStatus(userId: string, data: { role?: Role; isActive?: boolean }) {
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists || userExists.deletedAt) {
      throw new NotFoundException('Target individual not found.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });
  }
}