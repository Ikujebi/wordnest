// src/auth/interfaces/login-response.interface.ts

import { TokenPair } from './token-pair.interface';
import { AuthenticatedUser } from './authenticated-user.interface';

export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: TokenPair;
}