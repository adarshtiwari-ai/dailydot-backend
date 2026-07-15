const PDFDocument = require('pdfkit');

const FIRM_NAME = process.env.FIRM_NAME || 'DailyDot Services';
const FIRM_GST = process.env.FIRM_GST || 'NOT PROVIDED';

const generateInvoicePDF = (invoiceData, res) => {
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceData.invoiceId}.pdf"`);

    // Pipe the document directly to the response
    doc.pipe(res);

    // ═══════════════════════════════════════════
    // HEADER — Firm Details (Left) + Invoice Meta (Right)
    // ═══════════════════════════════════════════
    doc.fontSize(20).font('Helvetica-Bold').text(FIRM_NAME, 50, 50);
    doc.fontSize(10).font('Helvetica').text(`GSTIN: ${FIRM_GST}`, 50, 75);

    doc.fontSize(16).font('Helvetica-Bold').text(invoiceData.documentType || 'INVOICE', 0, 50, { align: 'right' });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Bill No: ${invoiceData.invoiceId}`, 0, 75, { align: 'right' });
    doc.text(`Date: ${invoiceData.date}`, 0, 90, { align: 'right' });

    // ═══════════════════════════════════════════
    // CONSIGNEE DETAILS — Customer / Party Info
    // ═══════════════════════════════════════════
    doc.fontSize(12).font('Helvetica-Bold').text('Billed To:', 50, 130);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${invoiceData.customer.name}`, 50, 145);
    doc.text(`Phone: ${invoiceData.customer.phone}`, 50, 160);
    doc.text(`Address: ${invoiceData.customer.address}`, 50, 175, { width: 250 });
    doc.text(`Payment Mode: ${invoiceData.paymentMethod || 'N/A'}`, 50, 205);

    // ═══════════════════════════════════════════
    // 4-COLUMN ITEMIZED TABLE — S.No | Particulars | Qty | Amount
    // ═══════════════════════════════════════════
    const tableTop = 240;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('S.No', 50, tableTop);
    doc.text('Particulars', 100, tableTop);
    doc.text('Qty', 350, tableTop);
    doc.text('Amount (INR)', 400, tableTop, { width: 100, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

    // Line Items
    let yPosition = tableTop + 25;
    doc.font('Helvetica').fontSize(10);
    invoiceData.lineItems.forEach((item, index) => {
        doc.text((index + 1).toString(), 50, yPosition);
        doc.text(item.description, 100, yPosition, { width: 240 });
        doc.text((item.quantity || 1).toString(), 350, yPosition);
        doc.text((Number(item.amount) / 100).toFixed(2), 400, yPosition, { width: 100, align: 'right' });
        yPosition += 20;
    });

    doc.moveTo(50, yPosition + 5).lineTo(500, yPosition + 5).stroke();

    // ═══════════════════════════════════════════
    // SUMMARY — Subtotal, Fees, Discounts, Tax, Grand Total
    // ═══════════════════════════════════════════
    const summaryX = 300;
    const valueWidth = 100;
    const rightMargin = 400;

    let sumY = yPosition + 20;
    doc.font('Helvetica').fontSize(10);

    // Subtotal
    doc.text('Subtotal:', summaryX, sumY);
    doc.text((Number(invoiceData.summary.subtotal) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
    sumY += 15;

    // Dynamic Applied Fees (Platform Fee, Convenience Fee, etc.)
    if (invoiceData.summary.appliedFees && invoiceData.summary.appliedFees.length > 0) {
        invoiceData.summary.appliedFees.forEach(fee => {
            doc.text(`${fee.name}:`, summaryX, sumY);
            doc.text((Number(fee.amount) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
            sumY += 15;
        });
    }

    // Dynamic Applied Discounts (Promo codes, Courtesy discounts)
    if (invoiceData.summary.appliedDiscounts && invoiceData.summary.appliedDiscounts.length > 0) {
        invoiceData.summary.appliedDiscounts.forEach(disc => {
            doc.text(`${disc.name}:`, summaryX, sumY);
            doc.text(`-${(Number(Math.abs(disc.amount)) / 100).toFixed(2)}`, rightMargin, sumY, { width: valueWidth, align: 'right' });
            sumY += 15;
        });
    }

    // CGST
    if (invoiceData.summary.cgst > 0) {
        doc.text('CGST (9%):', summaryX, sumY);
        doc.text((Number(invoiceData.summary.cgst) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
        sumY += 15;
    }

    // SGST
    if (invoiceData.summary.sgst > 0) {
        doc.text('SGST (9%):', summaryX, sumY);
        doc.text((Number(invoiceData.summary.sgst) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
        sumY += 15;
    }

    // Divider before Grand Total
    sumY += 5;
    doc.moveTo(summaryX, sumY).lineTo(500, sumY).stroke();
    sumY += 10;

    // Grand Total
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Grand Total:', summaryX, sumY);
    doc.text((Number(invoiceData.summary.grandTotal) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });

    // ═══════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════
    sumY += 40;
    doc.font('Helvetica').fontSize(8);
    doc.text('This is a computer-generated invoice and does not require a physical signature.', 50, sumY, { align: 'center', width: 450 });

    // Finalize
    doc.end();
};

module.exports = {
    generateInvoicePDF
};
