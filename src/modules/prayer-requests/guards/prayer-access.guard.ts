import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Grants full prayer-management access (view all, assign, delete) to:
 * - SUPER_ADMIN — automatic, no department membership required.
 * - Anyone else (ADMIN or MEMBER role) — ONLY if they are an active
 *   DepartmentMember (LEADER or MEMBER) of the Prayer department.
 *   Role alone (e.g. being an ADMIN) is never sufficient on its own.
 */
@Injectable()
export class PrayerAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const member = await this.prisma.member.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to prayer management.');
    }

    const isPrayerDeptMember = await this.prisma.departmentMember.findFirst({
      where: {
        memberId: member.id,
        // No `role: 'LEADER'` filter — LEADER and regular MEMBER both qualify.
        deletedAt: null,
        status: 'ACTIVE',
        department: {
          slug: { in: ['prayer', 'intercessory-prayer', 'prayer-department'], mode: 'insensitive' },
        },
      },
      select: { id: true },
    });

    if (!isPrayerDeptMember) {
      throw new ForbiddenException(
        'Only Super Admins and Prayer Department members can access prayer management.',
      );
    }

    return true;
  }
}