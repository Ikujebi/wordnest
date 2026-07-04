import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If data has already been wrapped by successResponse() or paginate(), bypass processing
        if (data && typeof data === 'object' && 'success' in data && 'timestamp' in data) {
          return data;
        }

        return {
          success: true,
          message: 'Request successful',
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}