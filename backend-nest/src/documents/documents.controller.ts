import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseFilters, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { loadConfig } from '../config';
import { DocumentsService, DocumentDto, UploadedFile as Upload } from './documents.service';
import { MulterSizeFilter } from './multer-size.filter';

const MAX_BYTES = loadConfig().maxUploadBytes;

@Controller('api/documents')
@UseFilters(MulterSizeFilter)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(): Promise<DocumentDto[]> {
    return this.documents.list();
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES + 1 } }))
  upload(
    @Me() me: Member,
    @UploadedFile() file: Upload | undefined,
    @Body() body: { name?: string; category?: string; clientId?: string; projectId?: string },
  ): Promise<void> {
    return this.documents.upload(me, file, body ?? {});
  }

  @Post(':id/versions')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES + 1 } }))
  newVersion(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Upload | undefined): Promise<void> {
    return this.documents.uploadVersion(me, id, file);
  }

  @Patch(':id')
  @HttpCode(200)
  setStatus(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: string }): Promise<void> {
    return this.documents.setStatus(me, id, body?.status);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version') version: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const v = version === undefined || version === '' ? undefined : Number(version);
    const file = await this.documents.download(id, Number.isInteger(v) ? v : undefined);
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(file.contentType) ? file.contentType : 'application/octet-stream';
    res.set({
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${file.fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Content-Length': String(file.content.length),
    });
    res.end(file.content);
  }
}
