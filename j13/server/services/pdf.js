const PDFDocument = require('pdfkit');

class PdfService {
  async generateAnnotationReport(room, annotations) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this._renderHeader(doc, room);

      annotations.forEach((annotation, index) => {
        if (index > 0) {
          doc.addPage();
        }
        this._renderAnnotation(doc, annotation, index + 1);
      });

      this._renderFooter(doc, annotations.length);
      doc.end();
    });
  }

  _renderHeader(doc, room) {
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#1a1a2e')
       .text('3D Model Review Report', { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#666666')
       .text(`Room: ${room.name}`, { align: 'center' });

    doc.fontSize(10)
       .fillColor('#999999')
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.moveDown(1);

    doc.strokeColor('#e0e0e0')
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke();

    doc.moveDown(1);
  }

  _renderAnnotation(doc, annotation, index) {
    const resolved = annotation.resolved;

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(resolved ? '#4CAF50' : '#f44336')
       .text(`Annotation #${index} ${resolved ? '[RESOLVED]' : '[OPEN]'}`);

    doc.moveDown(0.3);

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#999999')
       .text(`By: ${annotation.user_name || 'Unknown'} | ${new Date(annotation.created_at).toLocaleString()}`);

    doc.moveDown(0.5);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#333333')
       .text(`Position: (${annotation.position_x.toFixed(3)}, ${annotation.position_y.toFixed(3)}, ${annotation.position_z.toFixed(3)})`);

    if (annotation.text_content && annotation.text_content.trim()) {
      doc.moveDown(0.3);
      doc.fontSize(11)
         .fillColor('#1a1a2e')
         .text(annotation.text_content, {
           width: 410,
           align: 'left'
         });
    }

    if (annotation.audio_url) {
      doc.moveDown(0.5);
      doc.fontSize(10)
         .fillColor('#2196F3')
         .text(`Audio Note: ${annotation.audio_duration ? Math.round(annotation.audio_duration) + 's' : 'Voice memo attached'}`);
    }

    if (annotation.camera_view) {
      doc.moveDown(0.5);
      doc.fontSize(9)
         .fillColor('#999999')
         .text('Camera view saved with this annotation');
    }

    if (annotation.resolved_at) {
      doc.moveDown(0.5);
      doc.fontSize(9)
         .fillColor('#4CAF50')
         .text(`Resolved: ${new Date(annotation.resolved_at).toLocaleString()}`);
    }

    doc.moveDown(0.5);
    doc.strokeColor('#e0e0e0')
       .lineWidth(0.5)
       .moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke();
  }

  _renderFooter(doc, totalAnnotations) {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(9)
         .fillColor('#999999')
         .font('Helvetica')
         .text(
           `Page ${i + 1} of ${pageCount} | Total Annotations: ${totalAnnotations}`,
           50,
           780,
           { align: 'center', width: 495 }
         );
    }
  }
}

module.exports = { pdfService: new PdfService() };
