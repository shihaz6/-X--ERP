import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

export const CONFLICT_MESSAGE = 'The change conflicts with existing data.';

/**
 * Maps a thrown error to an HTTP status and body. Database integrity violations (SQLSTATE class 23:
 * unique, foreign key, check, not null) become 409 with the same message the Spring backend returned.
 */
export function describeError(exception: unknown): { status: number; body: unknown } {
  if (exception instanceof HttpException) {
    return { status: exception.getStatus(), body: exception.getResponse() };
  }
  const code = (exception as { code?: unknown })?.code;
  if (typeof code === 'string' && code.startsWith('23')) {
    return { status: HttpStatus.CONFLICT, body: { error: CONFLICT_MESSAGE } };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { error: 'Internal server error' } };
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = describeError(exception);
    if (status >= 500) {
      this.log.error((exception as Error)?.stack ?? String(exception));
    }
    res.status(status).json(body);
  }
}
