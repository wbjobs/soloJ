import uuid
from django.db import models
from apps.accounts.models import User


class AnalysisTask(models.Model):
    TASK_TYPE_CHOICES = (
        ('process_bam', 'Process BAM'),
        ('process_vcf', 'Process VCF'),
        ('annotate_variants', 'Annotate Variants'),
        ('compare_samples', 'Compare Samples'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analysis_tasks')
    task_name = models.CharField(max_length=255)
    task_type = models.CharField(max_length=30, choices=TASK_TYPE_CHOICES)
    celery_task_id = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0)
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'tasks_analysis_task'
        ordering = ['-created_at']
