from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GenomicFileViewSet, ChunkUploadInitView, ChunkUploadChunkView, ChunkUploadCompleteView

router = DefaultRouter()
router.register(r'', GenomicFileViewSet, basename='genomic-file')

urlpatterns = [
    path('chunk-upload/init/', ChunkUploadInitView.as_view(), name='chunk-upload-init'),
    path('chunk-upload/chunk/', ChunkUploadChunkView.as_view(), name='chunk-upload-chunk'),
    path('chunk-upload/complete/', ChunkUploadCompleteView.as_view(), name='chunk-upload-complete'),
    path('', include(router.urls)),
]
