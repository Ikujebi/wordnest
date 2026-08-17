import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AuthUserService {
    constructor(private readonly prisma: PrismaService) { }

    normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    async mapAuthenticatedUser(user: any): Promise<AuthenticatedUser> {
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            emailVerified: user.emailVerified,
            isActive: user.isActive,
            memberId: user.member?.id ?? null,
            profilePictureUrl: user.profilePictureUrl ?? null,
            canAccessPrayerManagement: await this.computeCanAccessPrayerManagement(user),
        };
    }

    private async computeCanAccessPrayerManagement(user: any): Promise<boolean> {
        if (user.role === Role.SUPER_ADMIN) return true;

        const memberId = user.member?.id;
        if (!memberId) return false;

        const isPrayerDeptMember = await this.prisma.departmentMember.findFirst({
            where: {
                memberId,
                status: 'ACTIVE',
                deletedAt: null,
                department: {
                    slug: { in: ['prayer', 'intercessory-prayer', 'prayer-department'], mode: 'insensitive' },
                },
            },
            select: { id: true },
        });

        return !!isPrayerDeptMember;
    }
}