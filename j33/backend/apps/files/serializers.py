from rest_framework import serializers
from .models import GenomicFile


class GenomicFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenomicFile
        fields = (
            'id', 'user', 'filename', 'file_type', 'file_size',
            'file_path', 'sample_name', 'status', 'statistics',
            'genome_build', 'created_at',
        )
        read_only_fields = ('id', 'user', 'file_size', 'status', 'statistics', 'genome_build', 'created_at')


class GenomicFileUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenomicFile
        fields = ('file_path', 'file_type', 'sample_name')


class GenomicFileListSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenomicFile
        fields = (
            'id', 'filename', 'file_type', 'file_size',
            'sample_name', 'status', 'statistics', 'genome_build', 'created_at',
        )


class ChunkUploadInitSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    file_type = serializers.ChoiceField(choices=['BAM', 'VCF'])
    file_size = serializers.IntegerField(min_value=0)
    sample_name = serializers.CharField(max_length=255, required=False, default='')
    total_chunks = serializers.IntegerField(min_value=1)
    file_hash = serializers.CharField(max_length=64, required=False, default='')


class ChunkUploadChunkSerializer(serializers.Serializer):
    upload_id = serializers.CharField(max_length=100)
    chunk_index = serializers.IntegerField(min_value=0)
    chunk_file = serializers.FileField()


class ChunkUploadCompleteSerializer(serializers.Serializer):
    upload_id = serializers.CharField(max_length=100)
