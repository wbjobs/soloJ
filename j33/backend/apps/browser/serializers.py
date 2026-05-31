from rest_framework import serializers


class RegionQuerySerializer(serializers.Serializer):
    file_id = serializers.UUIDField()
    chrom = serializers.CharField()
    start = serializers.IntegerField(min_value=0)
    end = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if data['start'] >= data['end']:
            raise serializers.ValidationError('Start position must be less than end position.')
        return data


class CoverageQuerySerializer(serializers.Serializer):
    file_id = serializers.UUIDField()
    chrom = serializers.CharField()
    start = serializers.IntegerField(min_value=0)
    end = serializers.IntegerField(min_value=1)
    num_bins = serializers.IntegerField(min_value=1, max_value=5000, default=500, required=False)

    def validate(self, data):
        if data['start'] >= data['end']:
            raise serializers.ValidationError('Start position must be less than end position.')
        return data


class ReadSerializer(serializers.Serializer):
    query_name = serializers.CharField()
    flag = serializers.IntegerField()
    reference_name = serializers.CharField()
    reference_start = serializers.IntegerField()
    mapping_quality = serializers.IntegerField()
    cigarstring = serializers.CharField(allow_null=True)
    query_sequence = serializers.CharField(allow_null=True)
    query_qualities = serializers.ListField(child=serializers.IntegerField())
    is_reverse = serializers.BooleanField()
    is_secondary = serializers.BooleanField()
    is_supplementary = serializers.BooleanField()


class CoverageBinSerializer(serializers.Serializer):
    start = serializers.IntegerField()
    end = serializers.IntegerField()
    avg_depth = serializers.FloatField()
    max_depth = serializers.IntegerField()


class VariantSerializer(serializers.Serializer):
    chrom = serializers.CharField()
    pos = serializers.IntegerField()
    id = serializers.CharField(allow_null=True)
    ref = serializers.CharField()
    alts = serializers.ListField(child=serializers.CharField())
    qual = serializers.FloatField(allow_null=True)
    filter = serializers.ListField(child=serializers.CharField())
    info = serializers.DictField()


class RegionDataSerializer(serializers.Serializer):
    reads = ReadSerializer(many=True)
    coverage = CoverageBinSerializer(many=True)
    variants = VariantSerializer(many=True)
