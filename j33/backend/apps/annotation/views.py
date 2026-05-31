from io import BytesIO

from openpyxl import Workbook
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.files.models import GenomicFile
from apps.browser.services import VcfService
from apps.prediction.services import PathogenicityPredictor
from .serializers import (
    VariantAnnotationQuerySerializer,
    BatchAnnotationQuerySerializer,
    ExportVariantsSerializer,
)
from .services import AnnotationService


class VariantAnnotationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = VariantAnnotationQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = AnnotationService.annotate_variant(
            data['chrom'], data['pos'], data['ref'], data['alt']
        )
        return Response(result)

    def post(self, request):
        serializer = BatchAnnotationQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variants = serializer.validated_data['variants']

        results = AnnotationService.batch_annotate(variants)
        return Response({'annotations': results}, status=status.HTTP_200_OK)


class ExportVariantsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ExportVariantsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            genomic_file = GenomicFile.objects.get(
                id=data['file_id'], user=request.user
            )
        except GenomicFile.DoesNotExist:
            return Response(
                {'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND
            )

        if genomic_file.status != 'ready':
            return Response(
                {'error': f'File status is {genomic_file.status}, not ready'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_path = genomic_file.file_path.path
        chrom, start, end = data['chrom'], data['start'], data['end']
        min_quality = data.get('min_quality')
        variant_type_filter = data.get('variant_type')
        min_pathogenicity = data.get('min_pathogenicity')

        try:
            variants = VcfService.get_variants(file_path, chrom, start, end)
        except FileNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        wb = Workbook()
        ws = wb.active
        ws.title = 'Variants'

        headers = [
            '染色体', '位置', '参考碱基', '替代碱基', '变异类型', '质量分数',
            '基因', '转录本', '功能影响', 'SIFT评分', 'PolyPhen评分',
            'ClinVar临床意义', 'dbSNP ID', 'COSMIC ID',
            '致病性概率', '致病性分类',
        ]
        ws.append(headers)

        for variant in variants:
            ref = variant.get('ref', '')
            alts = variant.get('alts', [])
            qual = variant.get('qual')

            if min_quality is not None and qual is not None and qual < min_quality:
                continue

            annotation = AnnotationService.annotate_variant(
                chrom, variant.get('pos', 0), ref, alts[0] if alts else ''
            )

            for alt in alts:
                vtype = 'SNP'
                if len(ref) > 1 and len(alt) > 1:
                    vtype = 'MNP'
                elif len(ref) == 1 and len(alt) == 1:
                    vtype = 'SNP'
                elif len(ref) == 0 or alt == '':
                    vtype = 'INS' if len(alt) > len(ref) else 'DEL'
                elif len(alt) > len(ref):
                    vtype = 'INS'
                elif len(alt) < len(ref):
                    vtype = 'DEL'

                if variant_type_filter and vtype != variant_type_filter:
                    continue

                ensembl_data = annotation.get('ensembl') or {}
                clinvar_data = annotation.get('clinvar') or {}
                dbsnp_data = annotation.get('dbsnp') or {}
                cosmic_data = annotation.get('cosmic') or {}

                gene = ''
                transcript = ''
                consequence = ''
                sift = ''
                polyphen = ''

                transcript_consequences = ensembl_data.get('transcript_consequences') or []
                if transcript_consequences:
                    tc = transcript_consequences[0]
                    gene = tc.get('gene_symbol', '')
                    transcript = tc.get('transcript_id', '')
                    consequence = tc.get('consequence_terms', [''])[0] if tc.get('consequence_terms') else ''
                    sift = tc.get('sift_score', '')
                    polyphen = tc.get('polyphen_score', '')

                clinvar_significance = clinvar_data.get('clinical_significance', '')
                dbsnp_id = dbsnp_data.get('rs_id', '')
                cosmic_id = cosmic_data.get('cosmic_id', '')

                info = variant.get('info', {})
                prediction_features = {
                    'variant_type': vtype,
                    'conservation_score': info.get('phyloP', 0.5) if isinstance(info.get('phyloP'), (int, float)) else 0.5,
                    'population_af': info.get('AF', 0.0) if isinstance(info.get('AF'), (int, float)) else 0.0,
                    'is_coding': consequence in ('missense_variant', 'synonymous_variant', 'stop_gained', 'stop_lost', 'frameshift_variant'),
                    'is_splice_site': consequence in ('splice_acceptor_variant', 'splice_donor_variant', 'splice_region_variant'),
                    'is_promoter': consequence == 'regulatory_region_variant',
                    'clinvar_pathogenic': 'pathogenic' in str(clinvar_significance).lower(),
                    'gene_pli': info.get('pLI', 0.0) if isinstance(info.get('pLI'), (int, float)) else 0.0,
                }
                if sift != '' and sift is not None:
                    try:
                        prediction_features['sift_score'] = float(sift)
                    except (ValueError, TypeError):
                        pass
                if polyphen != '' and polyphen is not None:
                    try:
                        prediction_features['polyphen_score'] = float(polyphen)
                    except (ValueError, TypeError):
                        pass
                cadd = info.get('CADD')
                if cadd is not None:
                    try:
                        prediction_features['cadd_score'] = float(cadd)
                    except (ValueError, TypeError):
                        pass

                prediction = PathogenicityPredictor.predict(prediction_features)
                path_score = prediction['pathogenicity_score']
                path_class = prediction['classification']

                if min_pathogenicity is not None and path_score < min_pathogenicity:
                    continue

                ws.append([
                    chrom, variant.get('pos', 0), ref, alt, vtype, qual or '',
                    gene, transcript, consequence, sift, polyphen,
                    clinvar_significance, dbsnp_id, cosmic_id,
                    path_score, path_class,
                ])

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename=variants_{chrom}_{start}_{end}.xlsx'
        return response
