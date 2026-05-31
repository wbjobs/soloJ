interface WorkerParseMessage {
  type: 'parse';
  data: ArrayBuffer;
  fileName: string;
}

interface WorkerAnonymizeMessage {
  type: 'anonymize';
  files: Array<{ data: ArrayBuffer; fileName: string }>;
}

type WorkerMessage = WorkerParseMessage | WorkerAnonymizeMessage;

interface WorkerResult {
  type: 'metadata' | 'progress' | 'complete' | 'error' | 'anonymize_progress' | 'anonymize_complete';
  payload: any;
}

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

let wasmModule: any = null;

async function loadWasm() {
  if (wasmModule) return wasmModule;
  try {
    wasmModule = await import('../dicom-parser/pkg');
    await wasmModule.default();
    return wasmModule;
  } catch (err) {
    throw new Error(`WASM 加载失败: ${err}`);
  }
}

async function parseSmallFile(wasm: any, data: Uint8Array): Promise<void> {
  const resultStr = wasm.parse_dicom(data);
  const result = JSON.parse(resultStr);

  (self as unknown as Worker).postMessage({
    type: 'metadata',
    payload: result.metadata,
  } as WorkerResult);

  (self as unknown as Worker).postMessage({
    type: 'complete',
    payload: {
      pixel_data: result.pixel_data,
      width: result.width,
      height: result.height,
    },
  } as WorkerResult);
}

async function parseLargeFile(wasm: any, data: Uint8Array): Promise<void> {
  const metadataStr = wasm.extract_metadata(data);
  const metadata = JSON.parse(metadataStr);

  (self as unknown as Worker).postMessage({
    type: 'metadata',
    payload: metadata,
  } as WorkerResult);

  const totalRows = metadata.rows;
  const totalCols = metadata.columns;
  const totalSize = totalRows * totalCols * 4;
  const rgbaBuffer = new Uint8Array(totalSize);

  const parser = new wasm.DicomPixelParser(data);
  let processedRows = 0;

  while (parser.has_more_chunks()) {
    const chunkStr = parser.next_chunk_rgba();
    const chunk = JSON.parse(chunkStr);

    const chunkData = new Uint8Array(chunk.data);
    const startRow = chunk.start_row;
    const rowCount = chunk.row_count;
    const rowWidth = totalCols * 4;
    const offset = startRow * rowWidth;

    rgbaBuffer.set(chunkData, offset);

    processedRows += rowCount;
    const progress = Math.round((processedRows / totalRows) * 100);

    (self as unknown as Worker).postMessage({
      type: 'progress',
      payload: { percent: progress, processedRows, totalRows },
    } as WorkerResult);
  }

  parser.free();

  (self as unknown as Worker).postMessage({
    type: 'complete',
    payload: {
      pixel_data: Array.from(rgbaBuffer),
      width: totalCols,
      height: totalRows,
    },
  } as WorkerResult);
}

async function handleAnonymize(wasm: any, files: Array<{ data: ArrayBuffer; fileName: string }>): Promise<void> {
  const results: Array<{
    fileName: string;
    metadata: any;
    anonymizedData: Uint8Array;
  }> = [];

  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const { data, fileName } = files[i];
    const uint8Data = new Uint8Array(data);

    (self as unknown as Worker).postMessage({
      type: 'anonymize_progress',
      payload: {
        current: i + 1,
        total,
        currentFile: fileName,
        percent: Math.round(((i + 1) / total) * 100),
      },
    } as WorkerResult);

    try {
      const metadataStr = wasm.extract_metadata(uint8Data);
      const metadata = JSON.parse(metadataStr);

      const anonymizedData = wasm.anonymize_dicom(uint8Data);

      results.push({
        fileName,
        metadata,
        anonymizedData,
      });
    } catch (err: any) {
      (self as unknown as Worker).postMessage({
        type: 'anonymize_progress',
        payload: {
          current: i + 1,
          total,
          currentFile: `${fileName} (失败: ${err instanceof Error ? err.message : String(err)})`,
          percent: Math.round(((i + 1) / total) * 100),
        },
      } as WorkerResult);
    }
  }

  const transferable = results.map((r) => r.anonymizedData.buffer);
  (self as unknown as Worker).postMessage(
    {
      type: 'anonymize_complete',
      payload: results.map((r) => ({
        fileName: r.fileName,
        metadata: r.metadata,
        anonymizedData: r.anonymizedData,
      })),
    } as WorkerResult,
    transferable
  );
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  try {
    const wasm = await loadWasm();

    if (type === 'parse') {
      const { data, fileName } = event.data as WorkerParseMessage;
      const uint8Data = new Uint8Array(data);

      (self as unknown as Worker).postMessage({
        type: 'progress',
        payload: { percent: 0, status: 'WASM 模块已加载，开始解析...' },
      } as WorkerResult);

      if (data.byteLength > LARGE_FILE_THRESHOLD) {
        await parseLargeFile(wasm, uint8Data);
      } else {
        await parseSmallFile(wasm, uint8Data);
      }
    } else if (type === 'anonymize') {
      const { files } = event.data as WorkerAnonymizeMessage;
      await handleAnonymize(wasm, files);
    }
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      payload: err instanceof Error ? err.message : String(err),
    } as WorkerResult);
  }
};
