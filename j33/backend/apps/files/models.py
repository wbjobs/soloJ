import uuid
from django.conf import settings
from django.db import models
from apps.accounts.models import User


def genomic_file_upload_path(instance, filename):
    return f'{settings.GENOMIC_FILES_DIR}{instance.id}/{filename}'


class GenomicFile(models.Model):
    FILE_TYPE_CHOICES = (
        ('BAM', 'BAM'),
        ('VCF', 'VCF'),
    )
    STATUS_CHOICES = (
        ('uploading', 'Uploading'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('error', 'Error'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='genomic_files')
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    file_size = models.BigIntegerField(default=0)
    file_path = models.FileField(upload_to=genomic_file_upload_path)
    sample_name = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploading')
    statistics = models.JSONField(default=dict, blank=True)
    genome_build = models.CharField(max_length=10, blank=True, default='', verbose_name='GRCh37/GRCh38')
    upload_id = models.CharField(max_length=100, blank=True, default='', verbose_name='分片上传ID')
    chunk_uploaded = models.BigIntegerField(default=0, verbose_name='已上传字节数')
    total_chunks = models.IntegerField(default=0, verbose_name='总分片数')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'files_genomic_file'
        ordering = ['-created_at']
