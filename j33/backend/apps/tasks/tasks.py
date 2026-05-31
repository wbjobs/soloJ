import os
import subprocess
from celery import shared_task
from django.utils import timezone
from apps.files.models import GenomicFile
from apps.files.services import detect_genome_build
from apps.annotation.services import AnnotationService
from .models import AnalysisTask


@shared_task(bind=True)
def process_bam_file(self, genomic_file_id):
    try:
        genomic_file = GenomicFile.objects.get(id=genomic_file_id)
    except GenomicFile.DoesNotExist:
        return

    genomic_file.status = 'processing'
    genomic_file.save()

    file_path = genomic_file.file_path.path
    index_path = file_path + '.bai'

    if not os.path.exists(index_path):
        try:
            subprocess.run(
                ['samtools', 'index', file_path],
                check=True,
                capture_output=True,
                timeout=3600,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            genomic_file.status = 'error'
            genomic_file.statistics = {'error': str(e)}
            genomic_file.save()
            return

    try:
        stats_result = subprocess.run(
            ['samtools', 'flagstat', file_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=600,
        )
        idxstats_result = subprocess.run(
            ['samtools', 'idxstats', file_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=600,
        )

        statistics = {
            'flagstat': stats_result.stdout,
            'idxstats': idxstats_result.stdout,
        }

        try:
            import pysam
            samfile = pysam.AlignmentFile(file_path, 'rb')
            total_reads = samfile.mapped + samfile.unmapped
            statistics['total_reads'] = total_reads
            statistics['mapped_reads'] = samfile.mapped
            statistics['unmapped_reads'] = samfile.unmapped
            statistics['average_mapping_quality'] = 0
            samfile.close()
        except Exception:
            pass

        genomic_file.statistics = statistics
        genomic_file.status = 'ready'
        if not genomic_file.genome_build:
            genome_build = detect_genome_build(file_path, genomic_file.file_type)
            if genome_build:
                genomic_file.genome_build = genome_build
        genomic_file.save()

    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        genomic_file.status = 'error'
        genomic_file.statistics = {'error': str(e)}
        genomic_file.save()


@shared_task(bind=True)
def process_vcf_file(self, genomic_file_id):
    try:
        genomic_file = GenomicFile.objects.get(id=genomic_file_id)
    except GenomicFile.DoesNotExist:
        return

    genomic_file.status = 'processing'
    genomic_file.save()

    file_path = genomic_file.file_path.path
    index_path = file_path + '.tbi'

    if not os.path.exists(index_path):
        try:
            subprocess.run(
                ['bcftools', 'index', file_path],
                check=True,
                capture_output=True,
                timeout=3600,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            genomic_file.status = 'error'
            genomic_file.statistics = {'error': str(e)}
            genomic_file.save()
            return

    try:
        stats_result = subprocess.run(
            ['bcftools', 'stats', file_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=600,
        )

        statistics = {
            'bcftools_stats': stats_result.stdout,
        }

        try:
            import pysam
            vcf = pysam.VariantFile(file_path)
            variant_count = sum(1 for _ in vcf)
            statistics['variant_count'] = variant_count
            vcf.close()
        except Exception:
            pass

        genomic_file.statistics = statistics
        genomic_file.status = 'ready'
        if not genomic_file.genome_build:
            genome_build = detect_genome_build(file_path, genomic_file.file_type)
            if genome_build:
                genomic_file.genome_build = genome_build
        genomic_file.save()

    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        genomic_file.status = 'error'
        genomic_file.statistics = {'error': str(e)}
        genomic_file.save()


@shared_task(bind=True)
def annotate_variants(self, task_id, variants):
    try:
        task = AnalysisTask.objects.get(id=task_id)
    except AnalysisTask.DoesNotExist:
        return

    task.status = 'running'
    task.celery_task_id = self.request.id
    task.save()

    try:
        results = AnnotationService.batch_annotate(variants)
        task.result = {'annotations': results}
        task.status = 'completed'
        task.progress = 100
        task.completed_at = timezone.now()
        task.save()
    except Exception as e:
        task.status = 'failed'
        task.error_message = str(e)
        task.save()


@shared_task(bind=True)
def compare_samples(self, task_id, file_id_1, file_id_2):
    try:
        task = AnalysisTask.objects.get(id=task_id)
    except AnalysisTask.DoesNotExist:
        return

    task.status = 'running'
    task.celery_task_id = self.request.id
    task.save()

    try:
        import pysam

        file1 = GenomicFile.objects.get(id=file_id_1)
        file2 = GenomicFile.objects.get(id=file_id_2)

        genome_build_1 = file1.genome_build
        genome_build_2 = file2.genome_build
        build_mismatch = bool(genome_build_1 and genome_build_2 and genome_build_1 != genome_build_2)

        if genome_build_1 and not genome_build_2:
            genome_build_2 = detect_genome_build(file2.file_path.path, file2.file_type)
            if genome_build_2:
                file2.genome_build = genome_build_2
                file2.save()
        if genome_build_2 and not genome_build_1:
            genome_build_1 = detect_genome_build(file1.file_path.path, file1.file_type)
            if genome_build_1:
                file1.genome_build = genome_build_1
                file1.save()
        build_mismatch = bool(genome_build_1 and genome_build_2 and genome_build_1 != genome_build_2)

        vcf1 = pysam.VariantFile(file1.file_path.path)
        vcf2 = pysam.VariantFile(file2.file_path.path)

        variants1 = set()
        for record in vcf1:
            key = f'{record.chrom}:{record.pos}:{record.ref}:{",".join(record.alts or [])}'
            variants1.add(key)
        vcf1.close()

        variants2 = set()
        for record in vcf2:
            key = f'{record.chrom}:{record.pos}:{record.ref}:{",".join(record.alts or [])}'
            variants2.add(key)
        vcf2.close()

        shared = variants1 & variants2
        only_in_1 = variants1 - variants2
        only_in_2 = variants2 - variants1

        somatic_candidates = only_in_2 - variants1

        if build_mismatch and genome_build_1 == 'GRCh37':
            liftover_dir = os.path.join('/tmp', 'liftover')
            os.makedirs(liftover_dir, exist_ok=True)

        task.result = {
            'sample_1': str(file_id_1),
            'sample_2': str(file_id_2),
            'total_variants_sample_1': len(variants1),
            'total_variants_sample_2': len(variants2),
            'shared_variants': len(shared),
            'unique_to_sample_1': len(only_in_1),
            'unique_to_sample_2': len(only_in_2),
            'somatic_candidates': len(somatic_candidates),
            'somatic_candidate_list': list(somatic_candidates)[:1000],
            'genome_build_1': genome_build_1,
            'genome_build_2': genome_build_2,
            'build_mismatch': build_mismatch,
        }
        task.status = 'completed'
        task.progress = 100
        task.completed_at = timezone.now()
        task.save()

    except Exception as e:
        task.status = 'failed'
        task.error_message = str(e)
        task.save()
