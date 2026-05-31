class GenomeBuildService:
    GRCH37_LENGTHS = {
        '1': 249250621, '2': 243199373, '3': 198022430, '4': 191154276,
        '5': 180915260, '6': 171115067, '7': 159138663, '8': 146364022,
        '9': 141213431, '10': 135534747, '11': 135006516, '12': 133851895,
        '13': 115169878, '14': 107349540, '15': 102531392, '16': 90354753,
        '17': 81195210, '18': 78077248, '19': 59128983, '20': 63025520,
        '21': 48129895, '22': 51304566, 'X': 155270560, 'Y': 59373566,
    }
    GRCH38_LENGTHS = {
        '1': 248956422, '2': 242193529, '3': 198295559, '4': 190214555,
        '5': 181538259, '6': 170805979, '7': 159345973, '8': 145138636,
        '9': 138394717, '10': 133797422, '11': 135086622, '12': 133275309,
        '13': 114364328, '14': 107043718, '15': 101991189, '16': 90338345,
        '17': 83257441, '18': 80373285, '19': 58617616, '20': 64444167,
        '21': 46709983, '22': 50818468, 'X': 156040895, 'Y': 57227415,
    }

    @staticmethod
    def detect_from_bam(file_path):
        try:
            import pysam
            samfile = pysam.AlignmentFile(file_path, 'rb')
            header = samfile.header

            for pg_entry in header.get('PG', []):
                pn = pg_entry.get('PN', '')
                if 'bwa' in pn.lower() or 'bowtie' in pn.lower():
                    cl = pg_entry.get('CL', '')
                    if 'GRCh37' in cl or 'hg19' in cl:
                        samfile.close()
                        return 'GRCh37'
                    if 'GRCh38' in cl or 'hg38' in cl:
                        samfile.close()
                        return 'GRCh38'

            contig_lengths = {}
            sq_lines = header.get('SQ', [])
            for sq in sq_lines:
                sn = sq.get('SN', '')
                ln = sq.get('LN', 0)
                chrom = sn.replace('chr', '')
                if chrom in GenomeBuildService.GRCH37_LENGTHS or chrom in GenomeBuildService.GRCH38_LENGTHS:
                    contig_lengths[chrom] = ln

            samfile.close()
            return GenomeBuildService.guess_build(contig_lengths)
        except Exception:
            return ''

    @staticmethod
    def detect_from_vcf(file_path):
        try:
            import pysam
            vcf = pysam.VariantFile(file_path)

            header_lines = vcf.header.records
            for record in header_lines:
                if record.type == 'GENERIC':
                    line_str = str(record)
                    if line_str.startswith('##reference='):
                        ref = line_str.replace('##reference=', '').strip()
                        if 'GRCh37' in ref or 'hg19' in ref:
                            vcf.close()
                            return 'GRCh37'
                        if 'GRCh38' in ref or 'hg38' in ref:
                            vcf.close()
                            return 'GRCh38'

            contig_lengths = {}
            for contig in vcf.header.contigs.values():
                chrom = contig.name.replace('chr', '')
                ln = contig.length
                if ln and (chrom in GenomeBuildService.GRCH37_LENGTHS or chrom in GenomeBuildService.GRCH38_LENGTHS):
                    contig_lengths[chrom] = ln

            vcf.close()
            return GenomeBuildService.guess_build(contig_lengths)
        except Exception:
            return ''

    @staticmethod
    def guess_build(contig_lengths):
        if not contig_lengths:
            return ''

        matches_37 = 0
        matches_38 = 0
        for chrom, length in contig_lengths.items():
            if chrom in GenomeBuildService.GRCH37_LENGTHS and length == GenomeBuildService.GRCH37_LENGTHS[chrom]:
                matches_37 += 1
            if chrom in GenomeBuildService.GRCH38_LENGTHS and length == GenomeBuildService.GRCH38_LENGTHS[chrom]:
                matches_38 += 1

        if matches_37 == 0 and matches_38 == 0:
            return ''

        if matches_37 > matches_38:
            return 'GRCh37'
        if matches_38 > matches_37:
            return 'GRCh38'

        return ''


def detect_genome_build(file_path, file_type):
    if file_type == 'BAM':
        return GenomeBuildService.detect_from_bam(file_path)
    elif file_type == 'VCF':
        return GenomeBuildService.detect_from_vcf(file_path)
    return ''
