import { invoke } from '@tauri-apps/api/tauri';
import type {
  ParsedBook,
  BookMetadata,
  BookChapter,
  StyleConfig,
  RearrangedBook,
  SearchResult,
  DrmInfo,
  BatchJob,
  OcrConfig,
  OcrResult,
  DiffConfig,
  DiffReport,
} from '../types';

export const parseEbook = async (path: string): Promise<ParsedBook> => {
  return invoke<ParsedBook>('parse_ebook', { path });
};

export const getBookMetadata = async (path: string): Promise<BookMetadata> => {
  return invoke<BookMetadata>('get_book_metadata', { path });
};

export const removeDrm = async (inputPath: string, outputDir?: string): Promise<string> => {
  return invoke<string>('remove_drm', { inputPath, outputDir });
};

export const rearrangeStyle = async (
  chapters: BookChapter[],
  styleConfig: StyleConfig,
  originalCss: string[]
): Promise<RearrangedBook> => {
  return invoke<RearrangedBook>('rearrange_style', {
    chapters,
    styleConfig,
    originalCss,
  });
};

export const searchText = async (
  query: string,
  bookId?: string,
  limit?: number,
  offset?: number,
  indexPath: string = 'search_index.db'
): Promise<SearchResult> => {
  return invoke<SearchResult>('search_text', {
    query,
    bookId,
    limit,
    offset,
    indexPath,
  });
};

export const saveSearchIndex = async (
  book: ParsedBook,
  indexPath: string = 'search_index.db'
): Promise<number> => {
  return invoke<number>('save_search_index', { book, indexPath });
};

export const loadSearchIndex = async (
  indexPath: string = 'search_index.db'
): Promise<[number, number]> => {
  return invoke<[number, number]>('load_search_index', { indexPath });
};

export const exportToHtml = async (
  book: RearrangedBook,
  outputPath: string
): Promise<void> => {
  return invoke<void>('export_to_html', { book, outputPath });
};

export const batchProcess = async (job: BatchJob): Promise<BatchJob> => {
  return invoke<BatchJob>('batch_process', { job });
};

export const checkDrm = async (path: string): Promise<DrmInfo> => {
  return invoke<DrmInfo>('check_drm', { path });
};

export const getDefaultStyle = async (): Promise<StyleConfig> => {
  return invoke<StyleConfig>('get_default_style');
};

export const getReaderStyle = async (
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  theme: string
): Promise<StyleConfig> => {
  return invoke<StyleConfig>('get_reader_style', {
    fontFamily,
    fontSize,
    lineHeight,
    theme,
  });
};

export const scanDirectory = async (
  dirPath: string,
  recursive: boolean = true
): Promise<string[]> => {
  return invoke<string[]>('scan_directory', { dirPath, recursive });
};

export const listIndexedBooks = async (
  indexPath: string = 'search_index.db',
  limit?: number,
  offset?: number
): Promise<[string, BookMetadata][]> => {
  return invoke<[string, BookMetadata][]>('list_indexed_books', {
    indexPath,
    limit,
    offset,
  });
};

export const optimizeSearchIndex = async (
  indexPath: string = 'search_index.db'
): Promise<void> => {
  return invoke<void>('optimize_search_index', { indexPath });
};

export const clearSearchIndex = async (
  indexPath: string = 'search_index.db'
): Promise<void> => {
  return invoke<void>('clear_search_index', { indexPath });
};

export const checkOcrAvailable = async (config?: OcrConfig): Promise<boolean> => {
  return invoke<boolean>('check_ocr_available', { config });
};

export const runOcr = async (
  pdfPath: string,
  config?: OcrConfig
): Promise<OcrResult> => {
  return invoke<OcrResult>('run_ocr', { pdfPath, config });
};

export const exportOcrToMarkdown = async (
  ocrResult: OcrResult,
  outputPath: string
): Promise<void> => {
  return invoke<void>('export_ocr_to_markdown', { ocrResult, outputPath });
};

export const exportBookToMarkdown = async (
  book: ParsedBook,
  outputPath: string
): Promise<void> => {
  return invoke<void>('export_book_to_markdown', { book, outputPath });
};

export const compareBookVersions = async (
  oldBook: ParsedBook,
  newBook: ParsedBook,
  oldVersionLabel: string,
  newVersionLabel: string,
  config?: DiffConfig
): Promise<DiffReport> => {
  return invoke<DiffReport>('compare_book_versions', {
    oldBook,
    newBook,
    oldVersionLabel,
    newVersionLabel,
    config,
  });
};

export const exportDiffReport = async (
  report: DiffReport,
  outputPath: string,
  format: string
): Promise<void> => {
  return invoke<void>('export_diff_report', { report, outputPath, format });
};

export const getDefaultOcrConfig = async (): Promise<OcrConfig> => {
  return invoke<OcrConfig>('get_default_ocr_config');
};

export const getDefaultDiffConfig = async (): Promise<DiffConfig> => {
  return invoke<DiffConfig>('get_default_diff_config');
};
