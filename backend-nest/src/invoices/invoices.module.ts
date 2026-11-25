import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceDeliveryService } from './invoice-delivery.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceDeliveryService, InvoicePdfService],
  exports: [InvoicesService, InvoiceDeliveryService],
})
export class InvoicesModule {}
