from rest_framework import serializers


class VariantAnnotationQuerySerializer(serializers.Serializer):
    chrom = serializers.CharField()
    pos = serializers.IntegerField(min_value=1)
    ref = serializers.CharField()
    alt = serializers.CharField()


class BatchAnnotationQuerySerializer(serializers.Serializer):
    variants = VariantAnnotationQuerySerializer(many=True)


class EnsemblAnnotationSerializer(serializers.Serializer):
    assembly_name = serializers.CharField(allow_null=True)
    seq_region_name = serializers.CharField(allow_null=True)
    start = serializers.IntegerField(allow_null=True)
    end = serializers.IntegerField(allow_null=True)
    most_severe_consequence = serializers.CharField(allow_null=True)
    transcript_consequences = serializers.ListField(allow_null=True)


class ClinVarAnnotationSerializer(serializers.Serializer):
    clinical_significance = serializers.CharField(allow_null=True)
    review_status = serializers.CharField(allow_null=True)
    condition = serializers.CharField(allow_null=True)
    medgen_id = serializers.CharField(allow_null=True)


class DbSnpAnnotationSerializer(serializers.Serializer):
    rs_id = serializers.CharField(allow_null=True)
    maf = serializers.FloatField(allow_null=True)
    clinical = serializers.BooleanField(allow_null=True)


class CosmicAnnotationSerializer(serializers.Serializer):
    cosmic_id = serializers.CharField(allow_null=True)
    primary_site = serializers.CharField(allow_null=True)
    primary_histology = serializers.CharField(allow_null=True)
    mutation_description = serializers.CharField(allow_null=True)


class VariantAnnotationSerializer(serializers.Serializer):
    variant = serializers.CharField()
    ensembl = serializers.DictField(allow_null=True)
    clinvar = serializers.DictField(allow_null=True)
    dbsnp = serializers.DictField(allow_null=True)
    cosmic = serializers.DictField(allow_null=True)


class ExportVariantsSerializer(serializers.Serializer):
    file_id = serializers.UUIDField()
    chrom = serializers.CharField()
    start = serializers.IntegerField(min_value=0)
    end = serializers.IntegerField(min_value=1)
    min_quality = serializers.FloatField(required=False, allow_null=True)
    variant_type = serializers.CharField(required=False, allow_null=True)
    min_pathogenicity = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=1)
