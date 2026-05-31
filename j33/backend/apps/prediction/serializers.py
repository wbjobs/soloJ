from rest_framework import serializers


class VariantFeaturesSerializer(serializers.Serializer):
    variant_type = serializers.ChoiceField(
        choices=['SNP', 'INS', 'DEL', 'MNP', 'BND'], default='SNP'
    )
    conservation_score = serializers.FloatField(min_value=0, max_value=1, default=0.5)
    population_af = serializers.FloatField(min_value=0, max_value=1, default=0.0)
    sift_score = serializers.FloatField(min_value=0, max_value=1, required=False, allow_null=True)
    polyphen_score = serializers.FloatField(min_value=0, max_value=1, required=False, allow_null=True)
    cadd_score = serializers.FloatField(min_value=0, max_value=99, required=False, allow_null=True)
    is_coding = serializers.BooleanField(default=False)
    is_splice_site = serializers.BooleanField(default=False)
    is_promoter = serializers.BooleanField(default=False)
    clinvar_pathogenic = serializers.BooleanField(default=False)
    gene_pli = serializers.FloatField(min_value=0, max_value=1, default=0.0)


class PathogenicityPredictSerializer(serializers.Serializer):
    variant_features = VariantFeaturesSerializer()


class BatchPredictSerializer(serializers.Serializer):
    variants = VariantFeaturesSerializer(many=True)
