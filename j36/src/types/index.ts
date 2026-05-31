export type BookFormat = 'Pdf' | 'Epub' | 'Azw3' | 'Mobi' | 'Unknown';

export interface BookMetadata {
  title: string;
  authors: string[];
  publisher: string | null;
  publishDate: string | null;
  isbn: string | null;
  language: string | null;
  description: string | null;
  coverImage: number[] | null;
  tags: string[];
  pageCount: number | null;
  fileSize: number;
  format: BookFormat;
  drmProtected: boolean | null;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  color: string;
  textAlign: string;
  lineHeight: number;
  letterSpacing: number;
  textIndent: number;
}

export interface LayoutStyle {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  backgroundColor: string;
  columnCount: number;
  columnGap: number;
}

export interface StyleConfig {
  text: TextStyle;
  layout: LayoutStyle;
  headingStyles: Record<string, TextStyle>;
  customCss: string | null;
}

export interface ContentElement {
  id: string;
  elementType: string;
  content: string;
  style: TextStyle | null;
  attributes: Record<string, string>;
  children: ContentElement[];
}

export interface BookChapter {
  id: string;
  title: string;
  order: number;
  elements: ContentElement[];
  rawHtml: string | null;
}

export interface ParsedBook {
  metadata: BookMetadata;
  chapters: BookChapter[];
  cssStyles: string[];
  images: Record<string, number[]>;
  fonts: Record<string, number[]>;
  originalFormat: BookFormat;
  drmRemoved: boolean;
  sourcePath: string;
}

export interface RearrangedBook {
  metadata: BookMetadata;
  htmlContent: string;
  cssContent: string;
  styleConfig: StyleConfig;
  searchableText: string;
  chapterNavigation: [string, string][];
}

export interface SearchMatch {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  elementId: string;
  snippet: string;
  startPos: number;
  endPos: number;
  score: number;
}

export interface SearchResult {
  term: string;
  totalResults: number;
  results: SearchMatch[];
  searchTimeMs: number;
}

export interface DrmInfo {
  drmType: string | null;
  isProtected: boolean;
  canRemove: boolean;
  requiredTools: string[];
}

export type ProcessState = 'Pending' | 'Parsing' | 'RemovingDrm' | 'Rearranging' | 'Indexing' | 'Completed' | 'Failed' | 'Cancelled';

export interface ProcessStatus {
  bookId: string;
  status: ProcessState;
  progress: number;
  message: string;
  error: string | null;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

export type ExportFormat = 'Html' | 'Epub' | 'Pdf' | 'Mobipocket';

export interface BatchOptions {
  removeDrm: boolean;
  rearrangeStyle: boolean;
  createSearchIndex: boolean;
  preserveDirectoryStructure: boolean;
  preserveMetadata: boolean;
  exportFormat: ExportFormat;
  overwriteExisting: boolean;
}

export interface BatchFile {
  id: string;
  inputPath: string;
  outputPath: string | null;
  status: ProcessState;
  error: string | null;
  progress: number;
}

export interface BatchJob {
  id: string;
  name: string;
  inputDirectory: string;
  outputDirectory: string;
  styleConfig: StyleConfig;
  options: BatchOptions;
  files: BatchFile[];
  status: ProcessState;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
}

export interface AppState {
  currentView: 'library' | 'reader' | 'batch' | 'search' | 'settings' | 'ocr' | 'diff';
  selectedBook: ParsedBook | null;
  rearrangedBook: RearrangedBook | null;
  styleConfig: StyleConfig;
  batchJobs: BatchJob[];
  searchResults: SearchResult | null;
  searchQuery: string;
  isProcessing: boolean;
  error: string | null;
}

export interface OcrConfig {
  languages: string[];
  tesseractPath: string | null;
  trainedDataPath: string | null;
  dpi: number;
  enableTableDetection: boolean;
  enableLayoutAnalysis: boolean;
  preserveFormatting: boolean;
}

export type LayoutBlockType = 
  | 'Title' 
  | 'Heading1' 
  | 'Heading2' 
  | 'Heading3' 
  | 'Paragraph' 
  | 'Table' 
  | 'TableRow' 
  | 'TableCell' 
  | 'List' 
  | 'ListItem' 
  | 'Image' 
  | 'Footnote' 
  | 'Unknown';

export interface LayoutBlock {
  blockType: LayoutBlockType;
  text: string;
  boundingBox: [number, number, number, number];
  confidence: number;
  order: number;
  level: number;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  layoutBlocks: LayoutBlock[];
  processingTimeMs: number;
}

export interface OcrResult {
  pages: OcrPageResult[];
  totalPages: number;
  averageConfidence: number;
  totalProcessingTimeMs: number;
  markdownContent: string | null;
}

export interface DiffConfig {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  contextLines: number;
  minDiffLength: number;
}

export type DiffType = 'Added' | 'Removed' | 'Modified' | 'Unchanged';

export interface DiffSegment {
  diffType: DiffType;
  content: string;
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

export interface ChapterDiff {
  chapterId: string;
  chapterTitle: string;
  segments: DiffSegment[];
  hasChanges: boolean;
  similarityScore: number;
}

export interface DiffReport {
  oldVersionId: string;
  newVersionId: string;
  oldVersionLabel: string;
  newVersionLabel: string;
  chapterDiffs: ChapterDiff[];
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
  overallSimilarity: number;
  generatedAt: number;
  htmlReport: string | null;
}
