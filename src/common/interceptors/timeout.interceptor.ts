import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);

  constructor(
    private readonly configService: ConfigService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    const timeoutMs = this.configService.get<number>(
      'REQUEST_TIMEOUT',
      30000,
    );

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          this.logger.warn(
            `${request.method} ${request.originalUrl} timed out after ${timeoutMs}ms`,
          );

          return throwError(
            () =>
              new RequestTimeoutException(
                'Request timed out.',
              ),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}