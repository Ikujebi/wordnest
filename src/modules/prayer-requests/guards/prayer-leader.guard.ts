import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Grants access ONLY to:
 * - SUPER_ADMIN — automatic, no department membership required.
 * - An active DepartmentMember of the Prayer department with role LEADER
 *   specifically. Regular MEMBER-role department members are NOT admitted
 *   here — use PrayerAccessGuard instead for routes that any active prayer
 *   department member should reach (viewing the list, etc).
 *
 * Intended for actions only a manager should perform: assigning requests
 * to a team member. Distinct from PrayerAccessGuard on purpose so viewing
 * and assigning can be authorized independently.
 */
@Injectable()
export class PrayerLeaderGuard implements CanActivate {
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
      throw new ForbiddenException('Only the Prayer Department leader and Super Admins can assign prayer requests.');
    }

    const isPrayerDeptLeader = await this.prisma.departmentMember.findFirst({
      where: {
        memberId: member.id,
        role: 'LEADER',
        deletedAt: null,
        status: 'ACTIVE',
        department: {
          slug: { in: ['prayer', 'intercessory-prayer', 'prayer-department'], mode: 'insensitive' },
        },
      },
      select: { id: true },
    });

    if (!isPrayerDeptLeader) {
      throw new ForbiddenException(
        'Only the Prayer Department leader and Super Admins can assign prayer requests.',
      );
    }

    return true;
  }
}
