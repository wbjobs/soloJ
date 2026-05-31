import pysam
import os
from django.conf import settings
from collections import defaultdict


class BamService:
    @staticmethod
    def get_reads(file_path, chrom, start, end):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f'BAM file not found: {file_path}')

        index_path = file_path + '.bai'
        if not os.path.exists(index_path):
            raise FileNotFoundError(f'BAM index file not found: {index_path}')

        samfile = pysam.AlignmentFile(file_path, 'rb')
        reads = []
        for read in samfile.fetch(chrom, start, end):
            reads.append({
                'query_name': read.query_name,
                'flag': read.flag,
                'reference_name': read.reference_name,
                'reference_start': read.reference_start,
                'mapping_quality': read.mapping_quality,
                'cigarstring': read.cigarstring,
                'query_sequence': read.query_sequence,
                'query_qualities': list(read.query_qualities) if read.query_qualities else [],
                'is_reverse': read.is_reverse,
                'is_secondary': read.is_secondary,
                'is_supplementary': read.is_supplementary,
            })
        samfile.close()
        return reads

    @staticmethod
    def get_coverage(file_path, chrom, start, end, bin_size=1):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f'BAM file not found: {file_path}')

        index_path = file_path + '.bai'
        if not os.path.exists(index_path):
            raise FileNotFoundError(f'BAM index file not found: {index_path}')

        samfile = pysam.AlignmentFile(file_path, 'rb')
        coverage_data = []
        for col in samfile.pileup(chrom, start, end):
            if start <= col.reference_pos < end:
                coverage_data.append({
                    'position': col.reference_pos,
                    'depth': col.nsegments,
                })
        samfile.close()
        return coverage_data

    @staticmethod
    def get_binned_coverage(file_path, chrom, start, end, num_bins=500):
        raw_coverage = BamService.get_coverage(file_path, chrom, start, end)
        if not raw_coverage:
            return []

        region_size = end - start
        bin_size = max(1, region_size // num_bins)
        binned = []

        for i in range(num_bins):
            bin_start = start + i * bin_size
            bin_end = min(bin_start + bin_size, end)
            positions_in_bin = [
                c['depth'] for c in raw_coverage
                if bin_start <= c['position'] < bin_end
            ]
            avg_depth = sum(positions_in_bin) / len(positions_in_bin) if positions_in_bin else 0
            max_depth = max(positions_in_bin) if positions_in_bin else 0
            binned.append({
                'start': bin_start,
                'end': bin_end,
                'avg_depth': round(avg_depth, 2),
                'max_depth': max_depth,
            })
        return binned


class VcfService:
    @staticmethod
    def get_variants(file_path, chrom, start, end):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f'VCF file not found: {file_path}')

        index_path = file_path + '.tbi'
        if not os.path.exists(index_path) and not os.path.exists(file_path + '.csi'):
            raise FileNotFoundError(f'VCF index file not found')

        vcf = pysam.VariantFile(file_path)
        variants = []
        for record in vcf.fetch(chrom, start, end):
            info = dict(record.info) if record.info else {}
            for key in info:
                if isinstance(info[key], tuple):
                    info[key] = list(info[key])

            variant = {
                'chrom': record.chrom,
                'pos': record.pos,
                'id': record.id,
                'ref': record.ref,
                'alts': list(record.alts) if record.alts else [],
                'qual': record.qual,
                'filter': list(record.filter) if record.filter else [],
                'info': info,
            }
            variants.append(variant)
        vcf.close()
        return variants
