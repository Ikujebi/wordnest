import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AuthUserService {
    normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    mapAuthenticatedUser(user: any): AuthenticatedUser {
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            emailVerified: user.emailVerified,
            isActive: user.isActive,
            memberId: user.member?.id ?? null,
        };
    }
}