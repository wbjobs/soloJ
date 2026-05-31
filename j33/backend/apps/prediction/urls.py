from django.urls import path
from .views import PathogenicityPredictView

urlpatterns = [
    path('predict/', PathogenicityPredictView.as_view(), name='prediction-pathogenicity'),
]
