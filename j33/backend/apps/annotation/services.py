import requests
from pymongo import MongoClient
from django.conf import settings


def get_mongo_collection(collection_name):
    mongo_config = settings.MONGODB
    if mongo_config['USERNAME'] and mongo_config['PASSWORD']:
        client = MongoClient(
            host=mongo_config['HOST'],
            port=mongo_config['PORT'],
            username=mongo_config['USERNAME'],
            password=mongo_config['PASSWORD'],
        )
    else:
        client = MongoClient(
            host=mongo_config['HOST'],
            port=mongo_config['PORT'],
        )
    db = client[mongo_config['DB']]
    return db[collection_name]


class AnnotationService:
    @staticmethod
    def annotate_variant(chrom, pos, ref, alt, genome_build=''):
        result = {
            'variant': f'{chrom}:{pos}{ref}>{alt}',
            'ensembl': None,
            'clinvar': None,
            'dbsnp': None,
            'cosmic': None,
        }

        result['ensembl'] = AnnotationService.query_ensembl(chrom, pos, ref, alt, genome_build)
        result['clinvar'] = AnnotationService.query_clinvar(chrom, pos, ref, alt)
        result['dbsnp'] = AnnotationService.query_dbsnp(chrom, pos, ref, alt)
        result['cosmic'] = AnnotationService.query_cosmic(chrom, pos, ref, alt)

        return result

    @staticmethod
    def query_ensembl(chrom, pos, ref, alt, genome_build=''):
        if genome_build == 'GRCh37':
            api_url = 'https://grch37.rest.ensembl.org'
        elif genome_build == 'GRCh38':
            api_url = 'https://rest.ensembl.org'
        else:
            api_url = settings.ENSEMBL_REST_API

        endpoint = f'{api_url}/vep/human/region/{chrom}:{pos}:{ref}/{alt}'
        headers = {'Content-Type': 'application/json'}

        try:
            response = requests.get(endpoint, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, list):
                    return data[0]
            return None
        except (requests.RequestException, ValueError):
            return None

    @staticmethod
    def query_clinvar(chrom, pos, ref, alt):
        try:
            collection = get_mongo_collection('clinvar_variants')
            variant = collection.find_one({
                'chrom': chrom,
                'pos': pos,
                'ref': ref,
                'alt': alt,
            })
            if variant:
                variant['_id'] = str(variant['_id'])
                return variant
            return None
        except Exception:
            return None

    @staticmethod
    def query_dbsnp(chrom, pos, ref, alt):
        try:
            collection = get_mongo_collection('dbsnp_variants')
            variant = collection.find_one({
                'chrom': chrom,
                'pos': pos,
                'ref': ref,
                'alt': alt,
            })
            if variant:
                variant['_id'] = str(variant['_id'])
                return variant
            return None
        except Exception:
            return None

    @staticmethod
    def query_cosmic(chrom, pos, ref, alt):
        try:
            collection = get_mongo_collection('cosmic_variants')
            variant = collection.find_one({
                'chrom': chrom,
                'pos': pos,
                'ref': ref,
                'alt': alt,
            })
            if variant:
                variant['_id'] = str(variant['_id'])
                return variant
            return None
        except Exception:
            return None

    @staticmethod
    def batch_annotate(variants, genome_build=''):
        results = []
        for v in variants:
            annotation = AnnotationService.annotate_variant(
                v.get('chrom', ''),
                v.get('pos', 0),
                v.get('ref', ''),
                v.get('alt', ''),
                genome_build,
            )
            results.append(annotation)
        return results
