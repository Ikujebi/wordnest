// src/auth/interfaces/jwt-payload.interface.ts

import { Role } from '../../../app/generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}