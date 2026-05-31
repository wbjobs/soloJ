from rest_framework import viewsets
from .models import AnalysisTask
from .serializers import AnalysisTaskSerializer, AnalysisTaskListSerializer


class AnalysisTaskViewSet(viewsets.ReadOnlyModelViewSet):
    def get_serializer_class(self):
        if self.action == 'list':
            return AnalysisTaskListSerializer
        return AnalysisTaskSerializer

    def get_queryset(self):
        return AnalysisTask.objects.filter(user=self.request.user)
