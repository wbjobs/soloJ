import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(__dirname, '../../reports');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.warn('⚠️  [pdfReportService] 缺少依赖: chartjs-node-canvas 和 pdfkit');
console.warn('⚠️  [pdfReportService] 请运行: npm install chartjs-node-canvas pdfkit');
console.warn('⚠️  [pdfReportService] 当前使用伪代码框架，生成真实PDF需要安装上述依赖');

let ChartJSNodeCanvas = null;
let PDFDocument = null;
let dependenciesLoaded = false;

async function loadDependencies() {
  if (dependenciesLoaded) {
    return { ChartJSNodeCanvas, PDFDocument };
  }

  try {
    const chartModule = await import('chartjs-node-canvas');
    ChartJSNodeCanvas = chartModule.ChartJSNodeCanvas;
    const pdfkitModule = await import('pdfkit');
    PDFDocument = pdfkitModule.default;
    dependenciesLoaded = true;
    console.log('[pdfReportService] 依赖加载成功');
  } catch (error) {
    console.warn('[pdfReportService] 依赖未安装，使用模拟模式');
    dependenciesLoaded = true;
  }

  return { ChartJSNodeCanvas, PDFDocument };
}

async function generateScatterChart(subtitleCorrections) {
  await loadDependencies();
  if (!ChartJSNodeCanvas) {
    console.warn('[pdfReportService] 跳过图表生成：chartjs-node-canvas 未安装');
    return null;
  }

  const configuration = {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '校准前',
          data: subtitleCorrections.map((c, i) => ({
            x: i + 1,
            y: c.originalStart - (c.vadStart || c.originalStart)
          })),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: '校准后',
          data: subtitleCorrections.map((c, i) => ({
            x: i + 1,
            y: c.correctedStart - (c.vadStart || c.originalStart)
          })),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: '校准前后时间偏移对比',
          font: { size: 16 }
        },
        legend: {
          position: 'top'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '字幕序号'
          }
        },
        y: {
          title: {
            display: true,
            text: '时间偏移 (秒)'
          }
        }
      }
    }
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: 800,
    height: 500,
    backgroundColour: 'white'
  });

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return imageBuffer;
}

async function generatePDFReport(task, subtitleCorrections, reportData) {
  await loadDependencies();
  if (!PDFDocument) {
    console.warn('[pdfReportService] 跳过PDF生成：pdfkit 未安装');
    const mockFilePath = path.join(REPORTS_DIR, `report_${task.id}_mock.txt`);
    const mockContent = `
校准报告（模拟）
================
任务ID: ${task.id}
视频文件: ${task.videoFileName}
字幕文件: ${task.subtitleFileName}

校准统计:
- 匹配率（前）: ${reportData.matchRateBefore?.toFixed(2) || 'N/A'}%
- 匹配率（后）: ${reportData.matchRateAfter?.toFixed(2) || 'N/A'}%
- 平均误差（前）: ${reportData.avgOffsetErrorBefore?.toFixed(3) || 'N/A'}s
- 平均误差（后）: ${reportData.avgOffsetErrorAfter?.toFixed(3) || 'N/A'}s

修正摘要:
- 总修正条数: ${subtitleCorrections.length}
- 修正时间范围: ${reportData.timeRange || 'N/A'}

注：此为模拟报告，安装 chartjs-node-canvas 和 pdfkit 后可生成真实PDF。
    `.trim();
    fs.writeFileSync(mockFilePath, mockContent, 'utf-8');
    return mockFilePath;
  }

  const chartBuffer = await generateScatterChart(subtitleCorrections);
  const filePath = path.join(REPORTS_DIR, `report_${task.id}_${Date.now()}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(20).text('字幕校准报告', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('一、任务基本信息');
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`任务ID: ${task.id}`);
    doc.text(`视频文件: ${task.videoFileName}`);
    doc.text(`字幕文件: ${task.subtitleFileName}`);
    doc.text(`视频时长: ${task.videoDuration ? task.videoDuration.toFixed(2) + ' 秒' : 'N/A'}`);
    doc.text(`模型版本: ${task.modelVersion || 'N/A'}`);
    doc.text(`创建时间: ${task.createdAt?.toLocaleString('zh-CN') || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('二、校准统计数据');
    doc.moveDown();
    doc.fontSize(11);
    const matchRateBefore = reportData.matchRateBefore ?? 0;
    const matchRateAfter = reportData.matchRateAfter ?? 0;
    const avgErrorBefore = reportData.avgOffsetErrorBefore ?? 0;
    const avgErrorAfter = reportData.avgOffsetErrorAfter ?? 0;

    doc.text(`匹配率（校准前）: ${matchRateBefore.toFixed(2)}%`);
    doc.text(`匹配率（校准后）: ${matchRateAfter.toFixed(2)}%`);
    doc.text(`平均误差（校准前）: ${avgErrorBefore.toFixed(3)} 秒`);
    doc.text(`平均误差（校准后）: ${avgErrorAfter.toFixed(3)} 秒`);
    doc.text(`VAD片段数: ${reportData.vadSegmentCount || 0}`);
    doc.text(`字幕片段数: ${reportData.subtitleSegmentCount || 0}`);
    doc.moveDown();

    doc.fontSize(14).text('三、校准前后对比');
    doc.moveDown();
    if (chartBuffer) {
      doc.image(chartBuffer, { width: 500, align: 'center' });
    } else {
      doc.fontSize(11).text('图表生成失败：缺少 chartjs-node-canvas 依赖');
    }
    doc.moveDown();

    doc.fontSize(14).text('四、字幕修正摘要');
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`总修正条数: ${subtitleCorrections.length}`);

    if (subtitleCorrections.length > 0) {
      const totalAdjustment = subtitleCorrections.reduce((sum, c) => {
        return sum + (c.correctedStart - c.originalStart);
      }, 0);
      const avgAdjustment = totalAdjustment / subtitleCorrections.length;
      const maxAdjustment = Math.max(...subtitleCorrections.map(c =>
        Math.abs(c.correctedStart - c.originalStart)
      ));

      doc.text(`平均调整量: ${avgAdjustment.toFixed(3)} 秒`);
      doc.text(`最大调整量: ${maxAdjustment.toFixed(3)} 秒`);
      doc.moveDown();

      doc.fontSize(12).text('部分修正示例：');
      doc.moveDown();
      doc.fontSize(10);
      const sampleCount = Math.min(5, subtitleCorrections.length);
      for (let i = 0; i < sampleCount; i++) {
        const c = subtitleCorrections[i];
        const adjustment = c.correctedStart - c.originalStart;
        doc.text(`#${c.subtitleIndex}: ${c.originalStart.toFixed(2)}s → ${c.correctedStart.toFixed(2)}s (调整: ${adjustment.toFixed(3)}s)`);
        if (c.originalText) {
          doc.text(`  文本: ${c.originalText.substring(0, 50)}${c.originalText.length > 50 ? '...' : ''}`);
        }
      }
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

function calculateMetrics(subtitleCorrections, vadSegments) {
  if (!subtitleCorrections || subtitleCorrections.length === 0) {
    return {
      matchRateBefore: 0,
      matchRateAfter: 0,
      avgOffsetErrorBefore: 0,
      avgOffsetErrorAfter: 0,
      originalOffset: 0,
      correctedOffset: 0,
      confidence: 0
    };
  }

  const errorsBefore = [];
  const errorsAfter = [];
  const matchedBefore = [];
  const matchedAfter = [];
  const threshold = 0.5;

  subtitleCorrections.forEach(c => {
    const reference = c.vadStart !== undefined ? c.vadStart : c.correctedStart;
    const errorBefore = Math.abs(c.originalStart - reference);
    const errorAfter = Math.abs(c.correctedStart - reference);

    errorsBefore.push(errorBefore);
    errorsAfter.push(errorAfter);
    matchedBefore.push(errorBefore < threshold ? 1 : 0);
    matchedAfter.push(errorAfter < threshold ? 1 : 0);
  });

  const avgErrorBefore = errorsBefore.reduce((a, b) => a + b, 0) / errorsBefore.length;
  const avgErrorAfter = errorsAfter.reduce((a, b) => a + b, 0) / errorsAfter.length;
  const matchRateBefore = (matchedBefore.reduce((a, b) => a + b, 0) / matchedBefore.length) * 100;
  const matchRateAfter = (matchedAfter.reduce((a, b) => a + b, 0) / matchedAfter.length) * 100;

  const totalOriginalOffset = subtitleCorrections.reduce((sum, c) =>
    sum + (c.originalStart - (c.vadStart || c.originalStart)), 0
  );
  const totalCorrectedOffset = subtitleCorrections.reduce((sum, c) =>
    sum + (c.correctedStart - (c.vadStart || c.correctedStart)), 0
  );

  return {
    matchRateBefore,
    matchRateAfter,
    avgOffsetErrorBefore: avgErrorBefore,
    avgOffsetErrorAfter: avgErrorAfter,
    originalOffset: totalOriginalOffset / subtitleCorrections.length,
    correctedOffset: totalCorrectedOffset / subtitleCorrections.length,
    confidence: Math.max(0, Math.min(1, (matchRateAfter - matchRateBefore) / 100 + 0.5)),
    vadSegmentCount: vadSegments ? vadSegments.length : 0,
    subtitleSegmentCount: subtitleCorrections.length,
    timeRange: subtitleCorrections.length > 0
      ? `${subtitleCorrections[0].originalStart.toFixed(2)}s - ${subtitleCorrections[subtitleCorrections.length - 1].originalEnd.toFixed(2)}s`
      : 'N/A'
  };
}

export default {
  generatePDFReport,
  calculateMetrics,
  generateScatterChart
};
