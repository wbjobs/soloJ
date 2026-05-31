import React, { useState, useCallback, useEffect, useRef } from 'react';
import DicomUploader from './components/DicomUploader';
import ImageCanvas from './components/ImageCanvas';
import MetadataDisplay from './components/MetadataDisplay';
import StatsChart from './components/StatsChart';
import { submitAuditLog, submitBatchAuditLogs } from './services/api';
import type { DicomParseResult, DicomMetadata, AuditLogRequest, AnonymizedFileResult, BatchAnonymizeProgress } from './types';
import JSZip from 'jszip';

interface WorkerProgress {
  percent: number;
  processedRows?: number;
  totalRows?: number;
  status?: string;
}

const App: React.FC = () => {
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<DicomParseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditSubmitted, setAuditSubmitted] = useState(false);
  const [auditResponse, setAuditResponse] = useState<{ id: number; created_at: string } | null>(null);
  const [parseProgress, setParseProgress] = useState<WorkerProgress | null>(null);
  const [pendingMetadata, setPendingMetadata] = useState<DicomMetadata | null>(null);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [anonymizeProgress, setAnonymizeProgress] = useState<BatchAnonymizeProgress | null>(null);
  const [anonymizedResults, setAnonymizedResults] = useState<AnonymizedFileResult[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('./workers/dicom.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'metadata':
            setPendingMetadata(payload);
            break;

          case 'progress':
            setParseProgress(payload);
            break;

          case 'complete':
            if (pendingMetadata) {
              setParseResult({
                metadata: pendingMetadata,
                pixel_data: payload.pixel_data,
                width: payload.width,
                height: payload.height,
              });
            } else {
              setParseResult(payload);
            }
            setIsLoading(false);
            setParseProgress(null);
            break;

          case 'anonymize_progress':
            setAnonymizeProgress(payload);
            break;

          case 'anonymize_complete': {
            const results: AnonymizedFileResult[] = payload;
            setAnonymizedResults(results);
            setIsAnonymizing(false);
            setAnonymizeProgress(null);
            handleBatchAuditAndZip(results);
            break;
          }

          case 'error':
            setError(payload || '解析 DICOM 文件失败');
            setIsLoading(false);
            setIsAnonymizing(false);
            setParseProgress(null);
            setAnonymizeProgress(null);
            break;
        }
      };

      workerRef.current.onerror = (err) => {
        console.error('Worker error:', err);
        setError('Web Worker 加载失败');
        setIsLoading(false);
        setIsAnonymizing(false);
        setParseProgress(null);
        setAnonymizeProgress(null);
      };

      setWasmLoaded(true);
    } catch (err) {
      console.error('Failed to create Worker:', err);
      setError('Web Worker 创建失败，请检查浏览器兼容性');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  useEffect(() => {
    if (pendingMetadata && parseResult === null && !isLoading) {
      setParseResult((prev) => prev);
    }
  }, [pendingMetadata]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (!workerRef.current) {
        setError('Web Worker 尚未就绪，请稍候');
        return;
      }

      setIsLoading(true);
      setError(null);
      setAuditSubmitted(false);
      setAuditResponse(null);
      setParseResult(null);
      setPendingMetadata(null);
      setAnonymizedResults([]);
      setParseProgress({ percent: 0, status: '正在读取文件...' });

      try {
        const arrayBuffer = await file.arrayBuffer();
        workerRef.current.postMessage(
          { type: 'parse', data: arrayBuffer, fileName: file.name },
          [arrayBuffer]
        );
      } catch (err) {
        console.error('Failed to read file:', err);
        setError(err instanceof Error ? err.message : '读取文件失败');
        setIsLoading(false);
        setParseProgress(null);
      }
    },
    []
  );

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!workerRef.current || files.length === 0) return;

      setIsAnonymizing(true);
      setError(null);
      setAnonymizedResults([]);
      setAnonymizeProgress({ current: 0, total: files.length, currentFile: '', percent: 0 });

      try {
        const fileData = await Promise.all(
          files.map(async (file) => ({
            data: await file.arrayBuffer(),
            fileName: file.name,
          }))
        );

        const transferables = fileData.map((f) => f.data);
        workerRef.current.postMessage(
          { type: 'anonymize', files: fileData },
          transferables
        );
      } catch (err) {
        console.error('Failed to read files:', err);
        setError(err instanceof Error ? err.message : '读取文件失败');
        setIsAnonymizing(false);
        setAnonymizeProgress(null);
      }
    },
    []
  );

  const handleBatchAuditAndZip = useCallback(async (results: AnonymizedFileResult[]) => {
    const auditRequests: AuditLogRequest[] = results
      .filter((r) => r.metadata.patient_name || r.metadata.patient_id)
      .map((r) => ({
        patient_name: r.metadata.patient_name,
        patient_id: r.metadata.patient_id,
        patient_birth_date: r.metadata.patient_birth_date,
        patient_sex: r.metadata.patient_sex,
        study_date: r.metadata.study_date,
        study_time: r.metadata.study_time,
        accession_number: r.metadata.accession_number,
        institution_name: r.metadata.institution_name,
        referring_physician: r.metadata.referring_physician,
        study_description: r.metadata.study_description,
        series_description: r.metadata.series_description,
        modality: r.metadata.modality,
        manufacturer: r.metadata.manufacturer,
      }));

    try {
      await submitBatchAuditLogs(auditRequests);
    } catch (err) {
      console.error('Failed to submit batch audit logs:', err);
    }

    try {
      const zip = new JSZip();
      for (const result of results) {
        const baseName = result.fileName.replace(/\.(dcm|dicom)$/i, '');
        zip.file(`${baseName}_anonymized.dcm`, result.anonymizedData);
      }

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anonymized_dicom_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      setError('创建 ZIP 文件失败');
    }
  }, []);

  const handleSubmitAudit = useCallback(async () => {
    if (!parseResult) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const metadata: DicomMetadata = parseResult.metadata;
      const auditRequest: AuditLogRequest = {
        patient_name: metadata.patient_name,
        patient_id: metadata.patient_id,
        patient_birth_date: metadata.patient_birth_date,
        patient_sex: metadata.patient_sex,
        study_date: metadata.study_date,
        study_time: metadata.study_time,
        accession_number: metadata.accession_number,
        institution_name: metadata.institution_name,
        referring_physician: metadata.referring_physician,
        study_description: metadata.study_description,
        series_description: metadata.series_description,
        modality: metadata.modality,
        manufacturer: metadata.manufacturer,
      };

      const response = await submitAuditLog(auditRequest);
      setAuditResponse({ id: response.id, created_at: response.created_at });
      setAuditSubmitted(true);
    } catch (err) {
      console.error('Failed to submit audit log:', err);
      setError('提交审计日志失败，请检查后端服务是否正常运行');
    } finally {
      setIsSubmitting(false);
    }
  }, [parseResult]);

  const effectiveMetadata = pendingMetadata || parseResult?.metadata || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h1 className="text-xl font-bold text-gray-900">DICOM 医学影像解析系统</h1>
                <p className="text-sm text-gray-500">本地解析 · 隐私保护 · 批量脱敏 · 审计追踪</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${wasmLoaded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${wasmLoaded ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                {wasmLoaded ? 'Worker 已就绪' : 'Worker 加载中'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {!wasmLoaded && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 flex items-center">
              <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在初始化 Web Worker...
            </p>
          </div>
        )}

        <div className="mb-8">
          <DicomUploader
            onFileSelected={handleFileSelected}
            onFilesSelected={handleFilesSelected}
            isLoading={isLoading || isAnonymizing}
            error={error}
          />
        </div>

        {isLoading && parseProgress && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-700 text-sm font-medium">{parseProgress.status || '正在解析像素数据...'}</p>
              <span className="text-blue-700 text-sm font-bold">{parseProgress.percent}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${parseProgress.percent}%` }}></div>
            </div>
            {parseProgress.totalRows && (
              <p className="text-blue-600 text-xs mt-1">已处理 {parseProgress.processedRows || 0} / {parseProgress.totalRows} 行</p>
            )}
          </div>
        )}

        {isAnonymizing && anonymizeProgress && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-amber-700 text-sm font-medium">
                批量脱敏中: {anonymizeProgress.currentFile}
              </p>
              <span className="text-amber-700 text-sm font-bold">
                {anonymizeProgress.current}/{anonymizeProgress.total} ({anonymizeProgress.percent}%)
              </span>
            </div>
            <div className="w-full bg-amber-200 rounded-full h-2.5">
              <div className="bg-amber-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${anonymizeProgress.percent}%` }}></div>
            </div>
          </div>
        )}

        {anonymizedResults.length > 0 && !isAnonymizing && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 flex items-center mb-2">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              已完成 {anonymizedResults.length} 个文件的脱敏处理，ZIP 文件已自动下载
            </p>
            <div className="flex flex-wrap gap-1">
              {anonymizedResults.map((r, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  {r.fileName}
                </span>
              ))}
            </div>
          </div>
        )}

        {auditSubmitted && auditResponse && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              审计日志已提交成功！记录 ID: {auditResponse.id}，时间: {auditResponse.created_at}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">影像预览</h2>
            <ImageCanvas
              pixelData={parseResult?.pixel_data || []}
              width={parseResult?.width || 0}
              height={parseResult?.height || 0}
            />
          </div>

          <div>
            <MetadataDisplay
              metadata={effectiveMetadata}
              onSubmitAudit={handleSubmitAudit}
              isSubmitting={isSubmitting}
              auditSubmitted={auditSubmitted}
            />
          </div>
        </div>

        <div className="mt-8">
          <StatsChart />
        </div>

        <div className="mt-8 p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">安全说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">本地解析</h4>
                <p className="text-sm text-gray-500">DICOM 文件在浏览器本地解析，原始影像不会上传</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">哈希存储</h4>
                <p className="text-sm text-gray-500">敏感元数据使用 SHA-256 哈希化后存储</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">批量脱敏</h4>
                <p className="text-sm text-gray-500">多文件选择后自动脱敏打包为 ZIP 下载</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">审计追踪</h4>
                <p className="text-sm text-gray-500">所有访问记录持久化存储，支持合规审计</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            DICOM 医学影像解析与审计系统 · 基于 Rust WebAssembly + React + FastAPI
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
