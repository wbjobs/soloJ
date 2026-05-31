import { jsPDF } from 'jspdf';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const captureVideoFrame = (videoElement, timestamp) => {
  return new Promise((resolve) => {
    if (!videoElement) {
      resolve(null);
      return;
    }

    const canvas = document.createElement('canvas');
    const width = videoElement.videoWidth || 1280;
    const height = videoElement.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const currentTime = videoElement.currentTime;

    videoElement.currentTime = timestamp;

    const handleSeeked = () => {
      ctx.drawImage(videoElement, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      videoElement.currentTime = currentTime;
      videoElement.removeEventListener('seeked', handleSeeked);
      resolve(dataUrl);
    };

    videoElement.addEventListener('seeked', handleSeeked);

    setTimeout(() => {
      videoElement.removeEventListener('seeked', handleSeeked);
      resolve(null);
    }, 3000);
  });
};

const drawAnnotationBox = (ctx, x, y, width, height, imgWidth, imgHeight, pageY) => {
  const boxX = x * imgWidth / 100;
  const boxY = y * imgHeight / 100;
  const boxW = width * imgWidth / 100;
  const boxH = height * imgHeight / 100;

  ctx.setDrawColor(255, 0, 0);
  ctx.setLineWidth(2);
  ctx.rect(boxX, pageY + boxY, boxW, boxH);
  ctx.stroke();
};

export const exportToPDF = async (exportData, videoElement) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('视频审片报告', margin, 25);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`导出时间: ${new Date(exportData.exportedAt).toLocaleString('zh-CN')}`, margin, 35);

  let currentY = 55;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('项目信息', margin, currentY);
  currentY += 8;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, currentY, contentWidth, 30, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`房间ID:`, margin + 5, currentY + 10);
  doc.text(`视频名称:`, margin + 5, currentY + 22);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`${exportData.roomId}`, margin + 40, currentY + 10);
  doc.text(`${exportData.video.name}`, margin + 40, currentY + 22);

  currentY += 40;

  if (exportData.annotations.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('暂无批注数据', margin, currentY);
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`批注列表 (共 ${exportData.annotations.length} 条)`, margin, currentY);
    currentY += 10;

    for (let i = 0; i < exportData.annotations.length; i++) {
      const annotation = exportData.annotations[i];

      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 25;
      }

      doc.setFillColor(102, 126, 234);
      doc.rect(margin, currentY, contentWidth, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${i + 1}  ${formatTime(annotation.timestamp)}`, margin + 3, currentY + 5.5);

      currentY += 12;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`批注人: ${annotation.userName}`, margin, currentY);
      currentY += 6;

      if (annotation.text) {
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(annotation.text, contentWidth - 10);
        doc.text(lines, margin, currentY);
        currentY += lines.length * 5 + 4;
      }

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(
        `位置: X=${annotation.x.toFixed(1)}%, Y=${annotation.y.toFixed(1)}%, 宽=${annotation.width.toFixed(1)}%, 高=${annotation.height.toFixed(1)}%`,
        margin,
        currentY
      );
      currentY += 5;

      if (annotation.replies && annotation.replies.length > 0) {
        currentY += 3;
        doc.setTextColor(102, 126, 234);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`回复 (${annotation.replies.length}条):`, margin, currentY);
        currentY += 6;

        annotation.replies.forEach((reply) => {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 25;
          }

          doc.setFillColor(240, 242, 255);
          doc.rect(margin + 5, currentY - 3, contentWidth - 10, 14, 'F');

          doc.setTextColor(102, 126, 234);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(`${reply.userName}:`, margin + 7, currentY + 2);

          doc.setTextColor(60, 60, 60);
          doc.setFont('helvetica', 'normal');
          const replyLines = doc.splitTextToSize(reply.text, contentWidth - 60);
          doc.text(replyLines, margin + 35, currentY + 2);

          currentY += replyLines.length * 4.5 + 4;
        });
      }

      currentY += 8;
    }

    if (videoElement && exportData.annotations.length > 0) {
      doc.addPage();
      currentY = 25;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('视频截图与批注位置', margin, currentY);
      currentY += 10;

      const imgWidth = contentWidth;
      const imgHeight = imgWidth * 9 / 16;

      for (let i = 0; i < Math.min(exportData.annotations.length, 3); i++) {
        const annotation = exportData.annotations[i];

        if (currentY + imgHeight + 30 > pageHeight) {
          doc.addPage();
          currentY = 25;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`#${i + 1}  ${formatTime(annotation.timestamp)} - ${annotation.userName}`, margin, currentY);
        currentY += 6;

        try {
          const frameData = await captureVideoFrame(videoElement, annotation.timestamp);
          if (frameData) {
            doc.addImage(frameData, 'JPEG', margin, currentY, imgWidth, imgHeight);

            const pageCanvas = document.createElement('canvas');
            const scale = 72 / 25.4;
            pageCanvas.width = imgWidth * scale;
            pageCanvas.height = imgHeight * scale;
            const pctx = pageCanvas.getContext('2d');

            const boxX = annotation.x * pageCanvas.width / 100;
            const boxY = annotation.y * pageCanvas.height / 100;
            const boxW = annotation.width * pageCanvas.width / 100;
            const boxH = annotation.height * pageCanvas.height / 100;

            pctx.strokeStyle = 'red';
            pctx.lineWidth = 3;
            pctx.strokeRect(boxX, boxY, boxW, boxH);

            const overlayData = pageCanvas.toDataURL('image/png');
            doc.addImage(overlayData, 'PNG', margin, currentY, imgWidth, imgHeight);
          } else {
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, currentY, imgWidth, imgHeight, 'F');
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(10);
            doc.text('视频截图加载中...', margin + 10, currentY + imgHeight / 2);
          }
        } catch (err) {
          console.error('Capture frame error:', err);
          doc.setFillColor(240, 240, 240);
          doc.rect(margin, currentY, imgWidth, imgHeight, 'F');
          doc.setTextColor(150, 150, 150);
          doc.setFontSize(10);
          doc.text('截图失败', margin + 10, currentY + imgHeight / 2);
        }

        currentY += imgHeight + 15;

        if (annotation.text) {
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          const commentLines = doc.splitTextToSize(`批注: ${annotation.text}`, contentWidth);
          doc.text(commentLines, margin, currentY);
          currentY += commentLines.length * 5;
        }

        currentY += 10;
      }
    }
  }

  const fileName = `审片报告_${exportData.roomId}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};
