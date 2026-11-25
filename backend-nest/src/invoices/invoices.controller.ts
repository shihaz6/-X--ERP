import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { InvoicesService, InvoiceDto } from './invoices.service';
import { InvoiceDeliveryService } from './invoice-delivery.service';

@Controller('api/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService, private readonly delivery: InvoiceDeliveryService) {}

  @Get()
  list(@Me() me: Member): Promise<InvoiceDto[]> {
    return this.invoices.list(me);
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: Parameters<InvoicesService['create']>[1]): Promise<void> {
    return this.invoices.create(me, body ?? {});
  }

  @Delete(':id')
  @HttpCode(200)
  delete(@Me() me: Member, @Param('id') id: string): Promise<void> {
    return this.invoices.delete(me, id);
  }

  @Post(':id/send')
  @HttpCode(200)
  send(@Me() me: Member, @Param('id') id: string): Promise<{ emailed: boolean }> {
    return this.delivery.send(me, id);
  }

  @Get(':id/pdf')
  async pdf(@Me() me: Member, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const buffer = await this.delivery.pdfFor(me, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Patch(':id')
  @HttpCode(200)
  setStatus(@Me() me: Member, @Param('id') id: string, @Body() body: { status?: string }): Promise<void> {
    return this.invoices.setStatus(me, id, body?.status);
  }
}
