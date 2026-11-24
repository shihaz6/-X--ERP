package com.alchemyx.erp.service;

import com.alchemyx.erp.model.Client;
import com.alchemyx.erp.model.Invoice;
import com.alchemyx.erp.model.WorkspaceSettings;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Service;

/** Renders an invoice as a PDF using the company details and template chosen in Settings. */
@Service
public class InvoicePdfService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    public byte[] render(Invoice inv, Client client, WorkspaceSettings s) {
        boolean modern = "Modern".equals(s.getInvoiceTemplate());
        Color accent = modern ? new Color(0xFF, 0x6A, 0x2D) : new Color(0x33, 0x33, 0x33);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 50, 50, 50, 50);
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, accent);
            Font label = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.DARK_GRAY);
            Font body = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);
            Font small = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY);

            String company = blankTo(s.getCompanyName(), "Company name not set");
            doc.add(new Paragraph(company, title));
            if (!blank(s.getRegistrationNo())) doc.add(new Paragraph("Reg. no. " + s.getRegistrationNo(), small));
            if (!blank(s.getRegisteredAddress())) doc.add(new Paragraph(s.getRegisteredAddress(), small));
            if (!blank(s.getBillingEmail())) doc.add(new Paragraph(s.getBillingEmail(), small));
            doc.add(Chunk.NEWLINE);

            Paragraph heading = new Paragraph("INVOICE " + inv.getId(), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK));
            heading.setSpacingAfter(12);
            doc.add(heading);

            PdfPTable meta = new PdfPTable(new float[] {1f, 2f});
            meta.setWidthPercentage(100);
            row(meta, "Bill to", client == null ? "—" : client.getName(), label, body);
            row(meta, "Issued", DATE.format(inv.getIssuedOn()), label, body);
            row(meta, "Due", DATE.format(inv.getDueOn()), label, body);
            row(meta, "Payment terms", blankTo(s.getPaymentTerms(), "—"), label, body);
            doc.add(meta);
            doc.add(Chunk.NEWLINE);

            PdfPTable lines = new PdfPTable(new float[] {4f, 1.4f});
            lines.setWidthPercentage(100);
            header(lines, "Description", accent);
            header(lines, "Amount (LKR)", accent);
            cell(lines, inv.getDescription(), body, Element.ALIGN_LEFT);
            cell(lines, String.format(Locale.ENGLISH, "%,.2f", inv.getAmount()), body, Element.ALIGN_RIGHT);
            doc.add(lines);

            Paragraph total = new Paragraph(String.format(Locale.ENGLISH, "Total due: LKR %,.2f", inv.getAmount()),
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, accent));
            total.setAlignment(Element.ALIGN_RIGHT);
            total.setSpacingBefore(12);
            doc.add(total);
            if (!blank(s.getTaxLabel())) {
                Paragraph tax = new Paragraph("Tax: " + s.getTaxLabel(), small);
                tax.setAlignment(Element.ALIGN_RIGHT);
                doc.add(tax);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Could not create the invoice PDF", e);
        } finally {
            doc.close();
        }
        return out.toByteArray();
    }

    private static void row(PdfPTable t, String k, String v, Font label, Font body) {
        cell(t, k, label, Element.ALIGN_LEFT);
        cell(t, v, body, Element.ALIGN_LEFT);
    }

    private static void header(PdfPTable t, String text, Color accent) {
        PdfPCell c = new PdfPCell(new Paragraph(text, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE)));
        c.setBackgroundColor(accent);
        c.setPadding(6);
        t.addCell(c);
    }

    private static void cell(PdfPTable t, String text, Font font, int align) {
        PdfPCell c = new PdfPCell(new Paragraph(text == null ? "" : text, font));
        c.setHorizontalAlignment(align);
        c.setPadding(6);
        t.addCell(c);
    }

    private static boolean blank(String v) {
        return v == null || v.isBlank();
    }

    private static String blankTo(String v, String fallback) {
        return blank(v) ? fallback : v;
    }
}
