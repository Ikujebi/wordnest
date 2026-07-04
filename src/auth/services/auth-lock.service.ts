import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthLockService {
    private static readonly MAX_FAILED_ATTEMPTS = 5;
    private static readonly LOCK_TIME_MINUTES = 15;

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Checks if the user's account lock timestamp is still active.
     */
    isAccountLocked(lockedUntil: Date | null): boolean {
        return !!lockedUntil && lockedUntil > new Date();
    }

    /**
     * Atomically increments failed attempts directly at the database layer.
     * This protects against concurrent brute-force attacks and race conditions.
     */
    async incrementFailedLoginAttempts(userId: string): Promise<void> {
        // 1. Increment the database counter atomically and return the updated count
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: {
                    increment: 1,
                },
            },
            select: { failedLoginAttempts: true },
        });

        // 2. Apply account lock rules if threshold is crossed
        if (updatedUser.failedLoginAttempts >= AuthLockService.MAX_FAILED_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + AuthLockService.LOCK_TIME_MINUTES * 60 * 1000);

            await this.prisma.user.update({
                where: { id: userId },
                data: { lockedUntil },
            });
        }
    }

    /**
     * Resets failed login counters back to pristine states upon successful login.
     */
    async resetFailedLoginAttempts(userId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { 
                failedLoginAttempts: 0, 
                lockedUntil: null 
            },
        });
    }
}