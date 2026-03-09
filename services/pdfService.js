const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoiceData, res) => {
    // Initialize a new PDFDocument
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceData.invoiceId}.pdf"`);

    // Pipe the document directly to the response
    doc.pipe(res);

    // Layout Design
    // Header
    doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('DailyDot', 50, 50)
        .fontSize(16)
        .text(invoiceData.documentType || 'INVOICE', 0, 50, { align: 'right' });

    doc.moveDown();

    // Meta
    doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice ID: ${invoiceData.invoiceId}`)
        .text(`Date: ${invoiceData.date.toLocaleString()}`)
        .text(`Payment Status: ${invoiceData.paymentStatus?.status?.toUpperCase() || 'UNKNOWN'} (${invoiceData.paymentStatus?.method?.toUpperCase() || 'N/A'})`);

    doc.moveDown(2);

    // Customer/Provider
    doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Billed To:')
        .font('Helvetica')
        .fontSize(10)
        .text(invoiceData.customer.name)
        .text(invoiceData.customer.address)
        .moveDown()
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Service By:')
        .font('Helvetica')
        .fontSize(10)
        .text(invoiceData.provider.name);

    doc.moveDown(2);

    // Line Items Header
    doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Description', 50, doc.y)
        .text('Amount (INR)', 400, doc.y, { width: 100, align: 'right' });

    doc.moveTo(50, doc.y + 5).lineTo(500, doc.y + 5).stroke();
    doc.moveDown(0.5);

    // Line Items
    doc.font('Helvetica').fontSize(10);
    let currentY = doc.y;
    invoiceData.lineItems.forEach(item => {
        doc.text(item.description, 50, currentY);
        doc.text((Number(item.amount) / 100).toFixed(2), 400, currentY, { width: 100, align: 'right' });
        currentY += 20;
    });

    doc.y = currentY + 10;
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(1);

    // Summary
    const summaryX = 300;
    const valueWidth = 100;
    const rightMargin = 400;

    let sumY = doc.y;

    doc.font('Helvetica');
    // Subtotal
    doc.text('Subtotal:', summaryX, sumY);
    doc.text((Number(invoiceData.summary.subtotal) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
    sumY += 15;

    // CGST
    doc.text('CGST (9%):', summaryX, sumY);
    doc.text((Number(invoiceData.summary.cgst) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
    sumY += 15;

    // SGST
    doc.text('SGST (9%):', summaryX, sumY);
    doc.text((Number(invoiceData.summary.sgst) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });
    sumY += 20;

    // Grand Total
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Grand Total:', summaryX, sumY);
    doc.text((Number(invoiceData.summary.grandTotal) / 100).toFixed(2), rightMargin, sumY, { width: valueWidth, align: 'right' });

    // Finalize
    doc.end();
};

module.exports = {
    generateInvoicePDF
};
