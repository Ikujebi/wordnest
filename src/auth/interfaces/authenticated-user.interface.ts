// src/auth/interfaces/authenticated-user.interface.ts

import { Role } from '../../../app/generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
    emailVerified: boolean;
  isActive: boolean;
    memberId: string | null;
}