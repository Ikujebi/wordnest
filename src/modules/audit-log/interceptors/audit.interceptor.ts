import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { AuditLogService } from '../audit-log.service';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { AuditMetadata } from '../interfaces/audit.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const metadata =
      this.reflector.get<AuditMetadata>(
        AUDIT_KEY,
        context.getHandler(),
      );

    // No @Audit() decorator → do nothing
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const user = request.user ?? {};

    const requestInfo = {
      ip:
        request.ip ||
        request.headers['x-forwarded-for'] ||
        request.socket?.remoteAddress,

      method: request.method,

      endpoint: request.originalUrl,

      userAgent: request.headers['user-agent'],
    };

    return next.handle().pipe(
      tap(async (result) => {
        try {
          await this.auditLogService.createLog(
            user,
            {
              ...metadata,

              // If entityId wasn't supplied,
              // attempt to infer it from the response
              entityId:
                metadata.entityId ??
                result?.id ??
                null,

              newValues: result,
            },
            requestInfo,
            {
              statusCode: response.statusCode,
              success: true,
            },
          );
        } catch (err) {
          console.error('Audit Log Error:', err);
        }
      }),

      catchError(async (error) => {
        try {
          await this.auditLogService.createLog(
            user,
            {
              ...metadata,
            },
            requestInfo,
            {
              statusCode:
                error.status ??
                response.statusCode,
              success: false,
            },
          );
        } catch (err) {
          console.error('Audit Log Error:', err);
        }

        throw error;
      }),
    );
  }
}