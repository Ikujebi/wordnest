import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard, but never blocks the request. A valid token populates
 * req.user as usual; a missing/invalid token just leaves req.user
 * undefined and the request proceeds anyway. Used on routes that behave
 * differently for logged-in vs anonymous callers (prayer request
 * submission) without requiring authentication.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: unknown, user: any) {
    return user || null; // never throws — this guard is purely additive
  }
}