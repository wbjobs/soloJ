from django.urls import path
from .views import VariantAnnotationView, ExportVariantsView

urlpatterns = [
    path('variant/', VariantAnnotationView.as_view(), name='annotation-variant'),
    path('export/', ExportVariantsView.as_view(), name='annotation-export'),
]
