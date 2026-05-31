import math


class PathogenicityPredictor:
    FEATURE_WEIGHTS = {
        'variant_type': 0.15,
        'conservation': 0.20,
        'population_freq': 0.15,
        'functional_impact': 0.20,
        'protein_domain': 0.10,
        'splice_proximity': 0.10,
        'clinvar_conflict': 0.10,
    }

    @staticmethod
    def predict(variant_features: dict) -> dict:
        scores = {}

        type_scores = {'SNP': 0.4, 'INS': 0.6, 'DEL': 0.7, 'MNP': 0.5, 'BND': 0.8}
        scores['variant_type'] = type_scores.get(variant_features.get('variant_type', 'SNP'), 0.4)

        scores['conservation'] = variant_features.get('conservation_score', 0.5)

        af = variant_features.get('population_af', 0.0)
        scores['population_freq'] = 1.0 - min(af * 100, 1.0) if af else 0.8

        func_score = 0.5
        if 'sift_score' in variant_features:
            func_score = 1.0 - variant_features['sift_score']
        if 'polyphen_score' in variant_features:
            func_score = max(func_score, variant_features['polyphen_score'])
        if 'cadd_score' in variant_features:
            func_score = max(func_score, min(variant_features['cadd_score'] / 30.0, 1.0))
        scores['functional_impact'] = func_score

        domain_score = 0.3
        if variant_features.get('is_coding'):
            domain_score = 0.6
        if variant_features.get('gene_pli', 0) > 0.9:
            domain_score = min(domain_score + 0.3, 1.0)
        scores['protein_domain'] = domain_score

        scores['splice_proximity'] = 0.9 if variant_features.get('is_splice_site') else 0.2
        if variant_features.get('is_promoter'):
            scores['splice_proximity'] = max(scores['splice_proximity'], 0.5)

        scores['clinvar_conflict'] = 0.9 if variant_features.get('clinvar_pathogenic') else 0.3

        total_weight = sum(PathogenicityPredictor.FEATURE_WEIGHTS.values())
        pathogenicity_score = sum(
            scores[k] * PathogenicityPredictor.FEATURE_WEIGHTS[k]
            for k in PathogenicityPredictor.FEATURE_WEIGHTS
        ) / total_weight

        pathogenicity_score = 1.0 / (1.0 + math.exp(-12 * (pathogenicity_score - 0.5)))

        if pathogenicity_score > 0.9 or pathogenicity_score < 0.1:
            confidence = 'high'
        elif pathogenicity_score > 0.7 or pathogenicity_score < 0.3:
            confidence = 'medium'
        else:
            confidence = 'low'

        if pathogenicity_score >= 0.9:
            classification = 'pathogenic'
        elif pathogenicity_score >= 0.7:
            classification = 'likely_pathogenic'
        elif pathogenicity_score <= 0.1:
            classification = 'benign'
        elif pathogenicity_score <= 0.3:
            classification = 'likely_benign'
        else:
            classification = 'VUS'

        feature_contributions = {
            k: round(scores[k] * PathogenicityPredictor.FEATURE_WEIGHTS[k] / total_weight, 4)
            for k in PathogenicityPredictor.FEATURE_WEIGHTS
        }

        return {
            'pathogenicity_score': round(pathogenicity_score, 4),
            'confidence': confidence,
            'classification': classification,
            'feature_contributions': feature_contributions,
        }

    @staticmethod
    def batch_predict(variants_features: list) -> list:
        return [PathogenicityPredictor.predict(vf) for vf in variants_features]
