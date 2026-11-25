import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { amount2, longDate } from '../common/format';
import type { InvoiceRow } from './invoices.service';

/** Company details and layout settings used on the PDF. */
export interface InvoiceSettings {
  company_name: string;
  registration_no: string;
  billing_email: string;
  registered_address: string;
  payment_terms: string;
  tax_label: string;
  invoice_template: string;
}

const blank = (v: string | null | undefined) => !v || !v.trim();

/** Renders an invoice as an A4 PDF using the company details and template chosen in Settings. */
@Injectable()
export class InvoicePdfService {
  render(inv: InvoiceRow, clientName: string | null, s: InvoiceSettings): Promise<Buffer> {
    const modern = s.invoice_template === 'Modern';
    const accent = modern ? '#FF6A2D' : '#333333';
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.font('Helvetica-Bold').fontSize(20).fillColor(accent)
      .text(blank(s.company_name) ? 'Company name not set' : s.company_name);
    doc.font('Helvetica').fontSize(9).fillColor('gray');
    if (!blank(s.registration_no)) doc.text(`Reg. no. ${s.registration_no}`);
    if (!blank(s.registered_address)) doc.text(s.registered_address);
    if (!blank(s.billing_email)) doc.text(s.billing_email);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(14).fillColor('black').text(`INVOICE ${inv.id}`).moveDown(0.8);

    const meta: [string, string][] = [
      ['Bill to', clientName ?? '—'],
      ['Issued', longDate(inv.issued_on)],
      ['Due', longDate(inv.due_on)],
      ['Payment terms', blank(s.payment_terms) ? '—' : s.payment_terms],
    ];
    for (const [label, value] of meta) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text(label, 50, doc.y, { continued: true, width: 150 });
      doc.font('Helvetica').fillColor('black').text(value, { width: 350 });
    }
    doc.moveDown();

    const top = doc.y;
    doc.rect(50, top, 495, 24).fill(accent);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('white')
      .text('Description', 58, top + 7, { width: 350 })
      .text('Amount (LKR)', 400, top + 7, { width: 137, align: 'right' });
    const rowTop = top + 24;
    doc.font('Helvetica').fontSize(10).fillColor('black')
      .text(inv.description || '', 58, rowTop + 8, { width: 330 })
      .text(amount2(Number(inv.amount)), 400, rowTop + 8, { width: 137, align: 'right' });
    doc.y = rowTop + 40;

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(accent)
      .text(`Total due: LKR ${amount2(Number(inv.amount))}`, { align: 'right' });
    if (!blank(s.tax_label)) {
      doc.font('Helvetica').fontSize(9).fillColor('gray').text(`Tax: ${s.tax_label}`, { align: 'right' });
    }

    doc.end();
    return done;
  }
}
