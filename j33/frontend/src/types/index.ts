export interface GenomicFile {
  id: string
  name: string
  type: 'bam' | 'vcf' | 'bed' | 'gff' | 'fasta'
  size: number
  uploadedAt: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  sampleName?: string
  indexPath?: string
  genomeBuild?: 'GRCh37' | 'GRCh38'
  stats?: FileStats
}

export interface FileStats {
  totalReads?: number
  mappedReads?: number
  avgCoverage?: number
  totalVariants?: number
  snpCount?: number
  indelCount?: number
}

export interface RegionData {
  chrom: string
  start: number
  end: number
  coverage: CoveragePoint[]
  variants: Variant[]
}

export interface CoveragePoint {
  position: number
  depth: number
}

export interface HeatmapCell {
  chrom: string
  start: number
  end: number
  variantCount: number
  avgPathogenicity: number
  enrichmentScore: number
}

export interface PathogenicityResult {
  pathogenicityScore: number
  confidence: 'high' | 'medium' | 'low'
  classification: 'pathogenic' | 'likely_pathogenic' | 'VUS' | 'likely_benign' | 'benign'
  featureContributions: Record<string, number>
}

export interface VariantExportFilters {
  minQuality?: number
  variantType?: string
  minPathogenicity?: number
}

export interface Variant {
  id: string
  chrom: string
  position: number
  ref: string
  alt: string
  quality: number
  filter: string
  type: 'SNP' | 'INS' | 'DEL' | 'MNP' | 'BND'
  annotation?: VariantAnnotation
  pathogenicity?: PathogenicityResult
}

export interface VariantAnnotation {
  gene: string
  transcript: string
  consequence: string
  impact: 'HIGH' | 'MODERATE' | 'LOW' | 'MODIFIER'
  clinVar?: ClinVarInfo
  dbSnpId?: string
  cosmicId?: string
  sift?: ScorePrediction
  polyPhen?: ScorePrediction
  cadd?: number
  af?: number
}

export interface ClinVarInfo {
  significance: 'Pathogenic' | 'Likely_pathogenic' | 'Uncertain_significance' | 'Likely_benign' | 'Benign'
  reviewStatus: string
  condition?: string
}

export interface ScorePrediction {
  score: number
  prediction: 'damaging' | 'tolerated' | 'possibly_damaging' | 'probably_damaging' | 'benign' | 'unknown'
}

export interface Task {
  id: string
  type: 'upload' | 'index' | 'annotate' | 'compare' | 'export'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message?: string
  createdAt: string
  completedAt?: string
  fileId?: string
  result?: Record<string, unknown>
}

export interface SamplePair {
  id: string
  sampleA: GenomicFile
  sampleB: GenomicFile
  createdAt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  diffRegions?: DiffRegion[]
  buildMismatch?: boolean
  buildA?: string
  buildB?: string
}

export interface DiffRegion {
  chrom: string
  start: number
  end: number
  coverageA: number
  coverageB: number
  foldChange: number
}

export interface TrackConfig {
  id: string
  type: 'coverage' | 'variants' | 'reads' | 'genes'
  label: string
  visible: boolean
  height: number
  color: string
  fileId: string
}

export const CHROMOSOMES = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19', 'chr20',
  'chr21', 'chr22', 'chrX', 'chrY'
] as const

export type ChromosomeName = typeof CHROMOSOMES[number]

export const CHROM_LENGTHS: Record<string, number> = {
  chr1: 248956422, chr2: 242193529, chr3: 198295559, chr4: 190214555,
  chr5: 181538259, chr6: 170805979, chr7: 159345973, chr8: 145138636,
  chr9: 138394717, chr10: 133797422, chr11: 135086622, chr12: 133275309,
  chr13: 114364328, chr14: 107043718, chr15: 101991189, chr16: 90338345,
  chr17: 83257441, chr18: 80373285, chr19: 58617616, chr20: 64444167,
  chr21: 46709983, chr22: 50818468, chrX: 156040895, chrY: 57227415,
}
