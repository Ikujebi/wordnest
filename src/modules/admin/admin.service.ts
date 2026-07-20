import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalEvents, activeDepartments] = await Promise.all([
      this.prisma.event.count({
        where: { 
          startDate: { gte: startOfToday },
          deletedAt: null
        },
      }),
      this.prisma.department.count({
        where: { deletedAt: null }
      }),
    ]);

    return {
      totalEvents,
      activeDepartments,
    };
  }

  // ==========================================
  //         INDIVIDUAL TARGETING METHODS
  // ==========================================

  /**
   * Fetch a specific individual member's profile along with their system user credentials.
   * Admins typically target members via their Member profile or connected User ID.
   */
  async targetIndividualMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phoneNumber: true,
            role: true,
            isActive: true,
          }
        },
        // If your schema links members to specific departments, you can include them here:
        // departments: true 
      }
    });

    if (!member || member.deletedAt) {
      throw new NotFoundException(`Member with ID ${memberId} does not exist or has been removed.`);
    }

    return member;
  }

  /**
   * Fetch all members under administrative purview (excluding soft-deleted accounts).
   */
  async listAllMembers() {
    return this.prisma.member.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            email: true,
            isActive: true
          }
        }
      },
      orderBy: { lastName: 'asc' }
    });
  }
}