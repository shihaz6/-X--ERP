import { HttpException, HttpStatus } from '@nestjs/common';

/** A business or request error. The body is {"error": message}, the shape the UI reads. */
export class ApiError extends HttpException {
  constructor(status: HttpStatus, message: string) {
    super({ error: message }, status);
    // HttpException would otherwise report a generic message, which logs and tests would show instead.
    this.message = message;
  }
}

export const badRequest = (message: string) => new ApiError(HttpStatus.BAD_REQUEST, message);
export const unauthorized = (message: string) => new ApiError(HttpStatus.UNAUTHORIZED, message);
export const forbidden = (message: string) => new ApiError(HttpStatus.FORBIDDEN, message);
export const notFound = (message: string) => new ApiError(HttpStatus.NOT_FOUND, message);
export const conflict = (message: string) => new ApiError(HttpStatus.CONFLICT, message);
export const tooLarge = (message: string) => new ApiError(HttpStatus.PAYLOAD_TOO_LARGE, message);
