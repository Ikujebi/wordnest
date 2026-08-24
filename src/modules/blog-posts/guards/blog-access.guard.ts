import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class BlogAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.role === Role.SUPER_ADMIN) return true;

    const member = await this.prisma.member.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Only Super Admins or the Media Department leader can manage blog notifications.');

    const isMediaLeader = await this.prisma.departmentMember.findFirst({
      where: {
        memberId: member.id,
        role: 'LEADER',
        status: 'ACTIVE',
        deletedAt: null,
        department: {
          OR: [
            { slug: { in: ['media', 'media-department', 'media-team'], mode: 'insensitive' } },
            { name: { contains: 'media', mode: 'insensitive' } },
          ],
        },
      },
    });

    if (!isMediaLeader) {
      throw new ForbiddenException('Only Super Admins or the Media Department leader can manage blog notifications.');
    }
    return true;
  }
}