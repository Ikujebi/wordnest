import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [totalEvents, activeDepartments] = await Promise.all([
      // Uses 'startDate' as defined in your Event model
      this.prisma.event.count({
        where: { 
          startDate: { gte: new Date() },
          deletedAt: null // Excludes soft-deleted events
        },
      }),
      // Counts departments that are not soft-deleted
      this.prisma.department.count({
        where: { deletedAt: null }
      }),
    ]);

    return {
      totalEvents,
      activeDepartments,
    };
  }
}