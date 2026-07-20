import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async getPersonalDashboard(memberId: string) {
    const [personalGivingSum, departmentRelations] = await Promise.all([
      // Fix 1: Change 'donorId' to 'memberId' to match your schema
      this.prisma.giving.aggregate({
        _sum: { amount: true },
        where: { 
          memberId: memberId,
          deletedAt: null // Exclude soft-deleted records since you have this field
        },
      }),
      // Fix 2: Match your actual join table structure (DepartmentMember)
      this.prisma.departmentMember.findMany({
        where: {
          memberId: memberId,
          status: 'ACTIVE',
          deletedAt: null
        },
        select: {
          department: {
            select: { name: true }
          }
        },
      }),
    ]);

    // Fix 3: Safe optional chaining (?.) and type conversion to clear TS errors
    const totalContributed = personalGivingSum?._sum?.amount 
      ? Number(personalGivingSum._sum.amount) 
      : 0;

    return {
      myTotalContributions: totalContributed,
      myDepartments: departmentRelations.map(rel => rel.department.name),
    };
  }
}