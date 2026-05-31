from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnalysisTaskViewSet

router = DefaultRouter()
router.register(r'', AnalysisTaskViewSet, basename='analysis-task')

urlpatterns = [
    path('', include(router.urls)),
]
