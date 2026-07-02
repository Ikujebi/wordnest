import { Role } from '../../../app/generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}