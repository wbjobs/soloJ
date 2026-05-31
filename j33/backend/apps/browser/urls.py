from django.urls import path
from .views import RegionView, CoverageView, VariantsView

urlpatterns = [
    path('region/', RegionView.as_view(), name='browser-region'),
    path('coverage/', CoverageView.as_view(), name='browser-coverage'),
    path('variants/', VariantsView.as_view(), name='browser-variants'),
]
