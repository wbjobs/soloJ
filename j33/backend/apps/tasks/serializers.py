from rest_framework import serializers
from .models import AnalysisTask


class AnalysisTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisTask
        fields = (
            'id', 'user', 'task_name', 'task_type', 'celery_task_id',
            'status', 'progress', 'parameters', 'result', 'error_message',
            'created_at', 'completed_at',
        )
        read_only_fields = (
            'id', 'user', 'celery_task_id', 'status', 'progress',
            'result', 'error_message', 'created_at', 'completed_at',
        )


class AnalysisTaskListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisTask
        fields = (
            'id', 'task_name', 'task_type', 'status', 'progress',
            'created_at', 'completed_at',
        )
