// src/auth/interfaces/auth-request.interface.ts

import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user.interface';

export interface AuthRequest extends Request {
  user: AuthenticatedUser;
}