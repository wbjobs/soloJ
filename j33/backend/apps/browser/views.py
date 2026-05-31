from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.files.models import GenomicFile
from .serializers import RegionQuerySerializer, CoverageQuerySerializer
from .services import BamService, VcfService


class RegionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = RegionQuerySerializer(data=request.query_params)
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

        result = {'reads': [], 'coverage': [], 'variants': []}

        if genomic_file.file_type == 'BAM':
            try:
                result['reads'] = BamService.get_reads(file_path, chrom, start, end)
                result['coverage'] = BamService.get_binned_coverage(file_path, chrom, start, end)
            except FileNotFoundError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        elif genomic_file.file_type == 'VCF':
            try:
                result['variants'] = VcfService.get_variants(file_path, chrom, start, end)
            except FileNotFoundError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)


class CoverageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CoverageQuerySerializer(data=request.query_params)
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

        if genomic_file.file_type != 'BAM':
            return Response(
                {'error': 'Coverage is only available for BAM files'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if genomic_file.status != 'ready':
            return Response(
                {'error': f'File status is {genomic_file.status}, not ready'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_path = genomic_file.file_path.path
        num_bins = data.get('num_bins', 500)

        try:
            coverage = BamService.get_binned_coverage(
                file_path, data['chrom'], data['start'], data['end'], num_bins
            )
        except FileNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'coverage': coverage})


class VariantsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = RegionQuerySerializer(data=request.query_params)
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

        if genomic_file.file_type != 'VCF':
            return Response(
                {'error': 'Variants are only available for VCF files'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if genomic_file.status != 'ready':
            return Response(
                {'error': f'File status is {genomic_file.status}, not ready'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_path = genomic_file.file_path.path

        try:
            variants = VcfService.get_variants(
                file_path, data['chrom'], data['start'], data['end']
            )
        except FileNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'variants': variants})
