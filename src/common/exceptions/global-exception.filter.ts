import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse();
      // Safely catch detailed NestJS Validation Pipe error arrays
      if (typeof errorResponse === 'object' && errorResponse !== null && 'message' in errorResponse) {
        message = (errorResponse as any).message;
      } else {
        message = exception.message;
      }
    } else {
      this.logger.error('Unhandled System Exception Caught:', exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}