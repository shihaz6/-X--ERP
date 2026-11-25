import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/** Maps an oversized upload to the same 413 response the Spring backend returned. */
@Catch(MulterError)
export class MulterSizeFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({ error: 'File is larger than the 25 MB limit' });
      return;
    }
    res.status(HttpStatus.BAD_REQUEST).json({ error: exception.message });
  }
}
