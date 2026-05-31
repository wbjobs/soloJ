from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import PathogenicityPredictSerializer, BatchPredictSerializer
from .services import PathogenicityPredictor


class PathogenicityPredictView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if 'variants' in request.data:
            serializer = BatchPredictSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            variants = serializer.validated_data['variants']
            results = PathogenicityPredictor.batch_predict(variants)
            return Response({'predictions': results}, status=status.HTTP_200_OK)
        else:
            serializer = PathogenicityPredictSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            variant_features = serializer.validated_data['variant_features']
            result = PathogenicityPredictor.predict(variant_features)
            return Response(result, status=status.HTTP_200_OK)
