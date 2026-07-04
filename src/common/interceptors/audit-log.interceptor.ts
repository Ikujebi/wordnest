import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, body } = request;

    // Only inspect mutating resource operations to optimize performance
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          // Gracefully continue even if request is anonymous (e.g., public contact form)
          if (!user?.id && !body?.fullName) return;

          try {
            const entityId = responseData?.id || body?.id || null;
            const segments = url.split('/');
            const entity = segments[1] || 'UNKNOWN';

            await this.prisma.auditLog.create({
              data: {
                userId: user?.id || null, // Optional for unauthenticated actions
                action: `${method} ${url}`,
                entity: entity.toUpperCase(),
                entityId: entityId ? String(entityId) : null,
                ipAddress: ip || '127.0.0.1',
              },
            });
          } catch (error) {
            // Keep logging decoupled from main thread execution to prevent cascading request failures
            this.logger.error(
              'Asynchronous Audit Log write sequence failed.',
              error instanceof Error ? error.stack : String(error),
            );
          }
        },
      }),
    );
  }
}