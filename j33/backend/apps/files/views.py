import os
import uuid
import shutil
from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from .models import GenomicFile
from .serializers import (
    GenomicFileSerializer, GenomicFileUploadSerializer, GenomicFileListSerializer,
    ChunkUploadInitSerializer, ChunkUploadChunkSerializer, ChunkUploadCompleteSerializer,
)
from .services import detect_genome_build
from apps.tasks.tasks import process_bam_file, process_vcf_file


class GenomicFileViewSet(viewsets.ModelViewSet):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get_serializer_class(self):
        if self.action == 'create':
            return GenomicFileUploadSerializer
        if self.action == 'list':
            return GenomicFileListSerializer
        return GenomicFileSerializer

    def get_queryset(self):
        return GenomicFile.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data['file_path']
        file_type = serializer.validated_data['file_type']
        sample_name = serializer.validated_data.get('sample_name', '')

        genomic_file = GenomicFile.objects.create(
            user=request.user,
            filename=uploaded_file.name,
            file_type=file_type,
            file_size=uploaded_file.size,
            file_path=uploaded_file,
            sample_name=sample_name,
            status='uploading',
        )
        genomic_file.status = 'processing'
        genomic_file.save()

        if file_type == 'BAM':
            process_bam_file.delay(str(genomic_file.id))
        elif file_type == 'VCF':
            process_vcf_file.delay(str(genomic_file.id))

        output_serializer = GenomicFileSerializer(genomic_file)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.file_path:
            file_path = instance.file_path.path
            if os.path.isfile(file_path):
                os.remove(file_path)
            index_path = file_path + '.bai'
            if os.path.isfile(index_path):
                os.remove(index_path)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        genomic_file = self.get_object()
        return Response({'statistics': genomic_file.statistics})


class ChunkUploadInitView(APIView):
    parser_classes = [parsers.JSONParser]

    def post(self, request):
        serializer = ChunkUploadInitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        upload_id = str(uuid.uuid4())
        genomic_file = GenomicFile.objects.create(
            user=request.user,
            filename=serializer.validated_data['filename'],
            file_type=serializer.validated_data['file_type'],
            file_size=serializer.validated_data['file_size'],
            sample_name=serializer.validated_data.get('sample_name', ''),
            status='uploading',
            upload_id=upload_id,
            total_chunks=serializer.validated_data['total_chunks'],
        )

        chunk_dir = os.path.join(settings.MEDIA_ROOT, 'genomic_files', 'chunks', upload_id)
        os.makedirs(chunk_dir, exist_ok=True)

        return Response({'upload_id': upload_id, 'file_id': str(genomic_file.id)}, status=status.HTTP_201_CREATED)


class ChunkUploadChunkView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        serializer = ChunkUploadChunkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        upload_id = serializer.validated_data['upload_id']
        chunk_index = serializer.validated_data['chunk_index']
        chunk_file = serializer.validated_data['chunk_file']

        try:
            genomic_file = GenomicFile.objects.get(upload_id=upload_id, user=request.user)
        except GenomicFile.DoesNotExist:
            return Response({'error': 'Invalid upload_id'}, status=status.HTTP_404_NOT_FOUND)

        chunk_dir = os.path.join(settings.MEDIA_ROOT, 'genomic_files', 'chunks', upload_id)
        chunk_path = os.path.join(chunk_dir, f'{chunk_index}.part')

        with open(chunk_path, 'wb') as f:
            for chunk in chunk_file.chunks():
                f.write(chunk)

        genomic_file.chunk_uploaded += chunk_file.size
        genomic_file.statistics = {
            **genomic_file.statistics,
            'uploaded_chunks': genomic_file.statistics.get('uploaded_chunks', 0) + 1,
            'chunk_uploaded_bytes': genomic_file.chunk_uploaded,
        }
        genomic_file.save()

        return Response({'upload_id': upload_id, 'chunk_index': chunk_index, 'received': True})


class ChunkUploadCompleteView(APIView):
    parser_classes = [parsers.JSONParser]

    def post(self, request):
        serializer = ChunkUploadCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        upload_id = serializer.validated_data['upload_id']

        try:
            genomic_file = GenomicFile.objects.get(upload_id=upload_id, user=request.user)
        except GenomicFile.DoesNotExist:
            return Response({'error': 'Invalid upload_id'}, status=status.HTTP_404_NOT_FOUND)

        chunk_dir = os.path.join(settings.MEDIA_ROOT, 'genomic_files', 'chunks', upload_id)
        if not os.path.isdir(chunk_dir):
            return Response({'error': 'Chunk directory not found'}, status=status.HTTP_404_NOT_FOUND)

        final_dir = os.path.join(settings.MEDIA_ROOT, 'genomic_files', str(genomic_file.id))
        os.makedirs(final_dir, exist_ok=True)
        final_path = os.path.join(final_dir, genomic_file.filename)

        part_files = sorted(
            [f for f in os.listdir(chunk_dir) if f.endswith('.part')],
            key=lambda x: int(x.split('.')[0]),
        )

        with open(final_path, 'wb') as out_f:
            for part_file in part_files:
                part_path = os.path.join(chunk_dir, part_file)
                with open(part_path, 'rb') as in_f:
                    shutil.copyfileobj(in_f, out_f)

        shutil.rmtree(chunk_dir)

        relative_path = os.path.relpath(final_path, settings.MEDIA_ROOT)
        genomic_file.file_path = relative_path
        genomic_file.status = 'processing'
        genomic_file.save()

        genome_build = detect_genome_build(final_path, genomic_file.file_type)
        if genome_build:
            genomic_file.genome_build = genome_build
            genomic_file.save()

        if genomic_file.file_type == 'BAM':
            process_bam_file.delay(str(genomic_file.id))
        elif genomic_file.file_type == 'VCF':
            process_vcf_file.delay(str(genomic_file.id))

        return Response({'file_id': str(genomic_file.id), 'status': 'processing'})
