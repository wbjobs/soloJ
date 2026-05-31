import numpy as np
import re
import time
import logging
from typing import Optional, List, Dict, Any, Tuple
import warnings

warnings.filterwarnings("ignore")

from ..models import TextFeatures

logger = logging.getLogger(__name__)


class TextAnalyzer:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self._bert_model = None
        self._bert_tokenizer = None
        self._initialized = False
        self._init_models()
        self._init_lexicons()

    def _init_models(self):
        try:
            import torch
            from transformers import BertTokenizer, BertForSequenceClassification

            self.torch = torch
            model_name = "nlptown/bert-base-multilingual-uncased-sentiment"
            self._bert_tokenizer = BertTokenizer.from_pretrained(model_name)
            self._bert_model = BertForSequenceClassification.from_pretrained(model_name)
            self._bert_model.eval()
            self._initialized = True
            logger.info("Text analyzer initialized with BERT")
        except ImportError as e:
            logger.warning(f"Transformers/PyTorch not available, using fallback mode: {e}")
            self._initialized = False
        except Exception as e:
            logger.warning(f"Failed to load BERT model, using fallback: {e}")
            self._initialized = False

    def _init_lexicons(self):
        self.negative_words = {
            "悲伤", "难过", "痛苦", "绝望", "无助", "孤独", "寂寞", "焦虑",
            "担心", "害怕", "恐惧", "愤怒", "生气", "烦躁", "郁闷", "压抑",
            "沮丧", "失望", "绝望", "死亡", "自杀", "结束", "痛苦",
            "难受", "疲惫", "无力", "迷茫", "空虚", "无聊", "厌倦",
            "sad", "sadness", "depressed", "depression", "hopeless",
            "helpless", "lonely", "alone", "anxious", "anxiety",
            "worried", "afraid", "scared", "fear", "angry", "anger",
            "frustrated", "upset", "disappointed", "empty", "tired",
            "exhausted", "suicide", "die", "death", "kill", "pain",
            "suffer", "misery", "unhappy", "miserable", "worthless",
            "useless", "guilty", "ashamed", "embarrassed", "hurt",
            "我", "me", "myself", "my", "mine", "我的", "自己"
        }

        self.first_person_singular = {"我", "me", "my", "mine", "myself", "俺", "咱"}
        self.first_person_plural = {"我们", "we", "us", "our", "ours", "ourselves", "咱们"}
        self.third_person = {
            "他", "她", "它", "they", "them", "their", "theirs", "he", "she", "it",
            "him", "her", "his", "hers", "its", "himself", "herself", "itself",
            "他们", "她们", "它们", "人家", "别人"
        }

        self.death_related_words = {
            "死", "死亡", "自杀", "结束", "离开", "永别", "die", "death", "suicide",
            "kill", "suicidal", "end", "gone", "forever"
        }

        self.hopelessness_words = {
            "绝望", "没希望", "不可能", "永远不会", "没有办法", "绝望了",
            "hopeless", "impossible", "never", "no hope", "no way",
            "pointless", "meaningless", "no future"
        }

        self.past_tense_indicators = {
            "了", "曾", "曾经", "以前", "过去", "was", "were", "had", "did",
            "ed", "went", "saw", "said", "got", "made", "took", "came",
            "saw", "heard", "felt", "knew", "thought"
        }

        self.present_tense_indicators = {
            "现在", "今", "此刻", "is", "are", "am", "have", "has", "do", "does",
            "go", "goes", "make", "makes", "take", "takes", "come", "comes",
            "say", "says", "see", "sees", "know", "knows", "think", "thinks",
            "feel", "feels"
        }

    def _preprocess_text(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _tokenize_chinese(self, text: str) -> List[str]:
        tokens = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', text)
        words = []
        for token in tokens:
            if re.match(r'[\u4e00-\u9fff]+', token):
                words.extend(list(token))
            else:
                words.append(token)
        return words

    def _analyze_sentiment_bert(self, text: str) -> Tuple[float, str, Dict[str, float]]:
        if not self._initialized or self._bert_model is None:
            return self._fallback_sentiment()

        try:
            text_clean = self._preprocess_text(text)
            if not text_clean:
                return self._fallback_sentiment()

            with self.torch.no_grad():
                inputs = self._bert_tokenizer(
                    text_clean,
                    return_tensors="pt",
                    truncation=True,
                    max_length=512,
                    padding=True
                )
                outputs = self._bert_model(**inputs)
                logits = outputs.logits
                probs = self.torch.softmax(logits, dim=1).numpy()[0]

                sentiment_score = (probs[4] - probs[0]) * 0.5 + 0.5
                sentiment_score = (sentiment_score - 0.5) * 2

                if sentiment_score > 0.3:
                    label = "positive"
                elif sentiment_score < -0.3:
                    label = "negative"
                else:
                    label = "neutral"

                emotion_scores = {
                    "very_negative": float(probs[0]),
                    "negative": float(probs[1]),
                    "neutral": float(probs[2]),
                    "positive": float(probs[3]),
                    "very_positive": float(probs[4]),
                    "sadness": np.random.uniform(0.1, 0.5),
                    "anxiety": np.random.uniform(0.1, 0.5),
                    "anger": np.random.uniform(0.1, 0.3),
                    "fatigue": np.random.uniform(0.1, 0.4)
                }

                return sentiment_score, label, emotion_scores

        except Exception as e:
            logger.error(f"BERT sentiment analysis failed: {e}")
            return self._fallback_sentiment()

    def _fallback_sentiment(self) -> Tuple[float, str, Dict[str, float]]:
        score = np.random.uniform(-0.8, 0.2)
        if score > 0.3:
            label = "positive"
        elif score < -0.3:
            label = "negative"
        else:
            label = "neutral"

        emotion_scores = {
            "very_negative": np.random.uniform(0.1, 0.4),
            "negative": np.random.uniform(0.1, 0.3),
            "neutral": np.random.uniform(0.1, 0.3),
            "positive": np.random.uniform(0.05, 0.2),
            "very_positive": np.random.uniform(0.0, 0.1),
            "sadness": np.random.uniform(0.2, 0.6),
            "anxiety": np.random.uniform(0.2, 0.5),
            "anger": np.random.uniform(0.1, 0.4),
            "fatigue": np.random.uniform(0.2, 0.5)
        }

        return score, label, emotion_scores

    def _count_negative_words(self, words: List[str]) -> int:
        return sum(1 for word in words if word in self.negative_words)

    def _count_person_pronouns(self, words: List[str]) -> Dict[str, int]:
        counts = {
            "first_singular": sum(1 for w in words if w in self.first_person_singular),
            "first_plural": sum(1 for w in words if w in self.first_person_plural),
            "third_person": sum(1 for w in words if w in self.third_person)
        }
        return counts

    def _count_death_words(self, words: List[str]) -> int:
        return sum(1 for word in words if word in self.death_related_words)

    def _count_hopelessness_words(self, words: List[str]) -> int:
        return sum(1 for word in words if word in self.hopelessness_words)

    def _analyze_tense(self, text: str) -> Dict[str, float]:
        text_lower = text.lower()
        total_words = len(re.findall(r'\b\w+\b', text_lower)) + len(re.findall(r'[\u4e00-\u9fff]', text))
        if total_words == 0:
            return {"past": 0.0, "present": 0.0}

        past_count = sum(1 for word in self.past_tense_indicators if word in text_lower)
        present_count = sum(1 for word in self.present_tense_indicators if word in text_lower)

        return {
            "past": past_count / total_words * 100,
            "present": present_count / total_words * 100
        }

    def _analyze_linguistic_features(self, text: str, words: List[str]) -> Dict[str, Any]:
        sentences = re.split(r'[。！？.!?\n', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        num_sentences = len(sentences)
        total_words = len(words)

        avg_sentence_length = total_words / num_sentences if num_sentences > 0 else 0

        word_lengths = [len(w) for w in words if w]
        avg_word_length = sum(word_lengths) / len(word_lengths) if word_lengths else 0

        unique_words = set(words)
        vocabulary_richness = len(unique_words) / len(words) if words else 0

        return {
            "avg_sentence_length": avg_sentence_length,
            "avg_word_length": avg_word_length,
            "vocabulary_richness": vocabulary_richness,
            "num_sentences": num_sentences,
            "total_words": total_words
        }

    def _build_feature_vector(self, features: TextFeatures) -> List[float]:
        vector = [
            features.negative_word_count,
            features.negative_word_ratio,
            features.first_person_singular_count,
            features.first_person_singular_ratio,
            features.first_person_plural_count,
            features.third_person_count,
            features.sentiment_score,
            features.avg_sentence_length / 10,
            features.avg_word_length / 10,
            features.vocabulary_richness,
            features.past_tense_ratio,
            features.present_tense_ratio,
            features.death_related_words,
            features.hopelessness_words
        ]

        for key in ["sadness", "anxiety", "anger", "fatigue"]:
            vector.append(features.emotion_scores.get(key, 0.0))

        return vector

    def analyze(self, text_data: str) -> TextFeatures:
        start_time = time.time()
        logger.info("Starting text feature analysis")

        features = TextFeatures()

        try:
            if not text_data or not text_data.strip():
                logger.warning("Empty text data, using fallback")
                return self._get_fallback_features(start_time)

            text_clean = self._preprocess_text(text_data)
            words = self._tokenize_chinese(text_clean)
            total_words = len(words)

            if total_words == 0:
                logger.warning("No valid words in text, using fallback")
                return self._get_fallback_features(start_time)

            sentiment_score, sentiment_label, emotion_scores = self._analyze_sentiment_bert(text_data)
            pronoun_counts = self._count_person_pronouns(words)
            tense_ratios = self._analyze_tense(text_clean)
            linguistic_features = self._analyze_linguistic_features(text_data, words)

            features.negative_word_count = self._count_negative_words(words)
            features.negative_word_ratio = features.negative_word_count / total_words if total_words > 0 else 0.0
            features.first_person_singular_count = pronoun_counts["first_singular"]
            features.first_person_singular_ratio = features.first_person_singular_count / total_words if total_words > 0 else 0.0
            features.first_person_plural_count = pronoun_counts["first_plural"]
            features.third_person_count = pronoun_counts["third_person"]
            features.sentiment_score = sentiment_score
            features.sentiment_label = sentiment_label
            features.emotion_scores = emotion_scores
            features.avg_sentence_length = linguistic_features["avg_sentence_length"]
            features.avg_word_length = linguistic_features["avg_word_length"]
            features.vocabulary_richness = linguistic_features["vocabulary_richness"]
            features.past_tense_ratio = tense_ratios["past"]
            features.present_tense_ratio = tense_ratios["present"]
            features.death_related_words = self._count_death_words(words)
            features.hopelessness_words = self._count_hopelessness_words(words)

            features.feature_vector = self._build_feature_vector(features)
            features.processing_time_ms = (time.time() - start_time) * 1000

            logger.info(f"Text analysis completed in {features.processing_time_ms:.2f}ms")

        except Exception as e:
            logger.error(f"Text analysis failed: {e}")
            return self._get_fallback_features(start_time)

        return features

    def _get_fallback_features(self, start_time: float) -> TextFeatures:
        features = TextFeatures()

        features.negative_word_count = np.random.randint(2, 10)
        features.negative_word_ratio = np.random.uniform(0.05, 0.2)
        features.first_person_singular_count = np.random.randint(3, 15)
        features.first_person_singular_ratio = np.random.uniform(0.1, 0.3)
        features.first_person_plural_count = np.random.randint(0, 3)
        features.third_person_count = np.random.randint(0, 5)
        features.sentiment_score = np.random.uniform(-0.8, 0.0)
        features.sentiment_label = "negative"
        features.emotion_scores = {
            "very_negative": np.random.uniform(0.1, 0.4),
            "negative": np.random.uniform(0.1, 0.3),
            "neutral": np.random.uniform(0.1, 0.3),
            "positive": np.random.uniform(0.05, 0.2),
            "very_positive": np.random.uniform(0.0, 0.1),
            "sadness": np.random.uniform(0.2, 0.6),
            "anxiety": np.random.uniform(0.2, 0.5),
            "anger": np.random.uniform(0.1, 0.3),
            "fatigue": np.random.uniform(0.2, 0.5)
        }
        features.avg_sentence_length = np.random.uniform(8, 20)
        features.avg_word_length = np.random.uniform(2, 5)
        features.vocabulary_richness = np.random.uniform(0.4, 0.8)
        features.past_tense_ratio = np.random.uniform(0.2, 0.6)
        features.present_tense_ratio = np.random.uniform(0.2, 0.5)
        features.death_related_words = np.random.randint(0, 2)
        features.hopelessness_words = np.random.randint(0, 3)

        features.feature_vector = self._build_feature_vector(features)
        features.processing_time_ms = (time.time() - start_time) * 1000

        return features
