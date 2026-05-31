import numpy as np
import time
import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings("ignore")

from ..models import (
    InterventionReport, InterventionRecommendation,
    HotlineInfo, CrisisLevel, InterventionConfig,
    HistoryTrajectory
)
from ..database import MongoDB
from .trend_prediction import TrendPredictor

logger = logging.getLogger(__name__)


class InterventionEngine:
    def __init__(
        self,
        db: Optional[MongoDB] = None,
        trend_predictor: Optional[TrendPredictor] = None,
        config: Optional[InterventionConfig] = None
    ):
        self.db = db or MongoDB()
        self.trend_predictor = trend_predictor or TrendPredictor(self.db)
        self.config = config or InterventionConfig()
        self._default_hotlines = self._get_default_hotlines()

    def _get_default_hotlines(self) -> List[HotlineInfo]:
        return [
            HotlineInfo(
                name="全国心理援助热线",
                phone="400-161-9995",
                service_hours="24小时",
                description="国家卫健委心理援助热线",
                is_crisis=True
            ),
            HotlineInfo(
                name="北京心理危机研究与干预中心",
                phone="010-82951332",
                service_hours="24小时",
                description="专业心理危机干预服务",
                is_crisis=True
            ),
            HotlineInfo(
                name="上海市心理援助热线",
                phone="021-12320-5",
                service_hours="24小时",
                description="上海市心理卫生中心",
                is_crisis=False
            ),
            HotlineInfo(
                name="青少年服务热线",
                phone="12355",
                service_hours="8:00-22:00",
                description="青少年心理健康与法律咨询",
                is_crisis=False
            ),
            HotlineInfo(
                name="妇女维权热线",
                phone="12338",
                service_hours="24小时",
                description="妇女心理健康与维权服务",
                is_crisis=False
            ),
            HotlineInfo(
                name="希望24热线",
                phone="400-161-9995",
                service_hours="24小时",
                description="生命教育与危机干预",
                is_crisis=True
            )
        ]

    def get_all_hotlines(self, include_crisis_only: bool = False) -> List[HotlineInfo]:
        hotlines = self._default_hotlines.copy()
        
        if self.config.custom_hotlines:
            hotlines.extend(self.config.custom_hotlines)
        
        if include_crisis_only:
            hotlines = [h for h in hotlines if h.is_crisis]
        
        return hotlines

    def _determine_crisis_level(self, score: float, trend: str, 
                                predicted_score: Optional[float] = None) -> CrisisLevel:
        final_score = predicted_score if predicted_score is not None else score
        
        if final_score >= 90 and trend == "rising":
            return CrisisLevel.CRITICAL
        elif final_score >= 85:
            return CrisisLevel.SEVERE
        elif final_score >= 70:
            return CrisisLevel.MODERATE
        elif final_score >= 50:
            return CrisisLevel.ELEVATED
        else:
            return CrisisLevel.NONE

    def _identify_triggering_factors(
        self,
        trajectory: HistoryTrajectory,
        prediction_result: Dict[str, Any]
    ) -> List[str]:
        factors = []
        
        if trajectory.score_trend:
            current_point = trajectory.score_trend[-1]
            
            if current_point.visual_contribution > 0.4:
                factors.append("视觉特征显示明显的抑郁体征（眼神回避、表情减少）")
            
            if current_point.audio_contribution > 0.4:
                factors.append("语音特征显示语速减慢、停顿增多")
            
            if current_point.text_contribution > 0.4:
                factors.append("文本内容包含较多消极词汇和绝望表达")
        
        if trajectory.trend_direction == "rising":
            factors.append("评分呈持续上升趋势，需密切关注")
        
        if trajectory.score_std < 5.0 and trajectory.avg_score > 70:
            factors.append("评分持续处于高位，缺乏波动")
        
        if prediction_result.get("risk_level") in ["high", "critical"]:
            factors.append("预测模型提示高风险")
        
        return factors

    def _generate_recommendations(
        self,
        crisis_level: CrisisLevel,
        triggering_factors: List[str]
    ) -> List[InterventionRecommendation]:
        recommendations = []
        
        if crisis_level in [CrisisLevel.SEVERE, CrisisLevel.CRITICAL]:
            recommendations.append(InterventionRecommendation(
                priority=1,
                category="immediate_crisis",
                title="立即寻求专业帮助",
                description="您的评分显示较高的抑郁风险水平，建议立即联系心理健康专业人士或前往医院就诊。",
                action_items=[
                    "拨打心理援助热线电话",
                    "联系家人或朋友陪伴",
                    "尽快前往精神卫生中心就诊",
                    "移除可能造成伤害的物品"
                ],
                timeframe="immediate"
            ))
        
        if crisis_level in [CrisisLevel.MODERATE, CrisisLevel.SEVERE, CrisisLevel.CRITICAL]:
            recommendations.append(InterventionRecommendation(
                priority=2,
                category="professional_help",
                title="寻求心理咨询",
                description="建议与专业心理咨询师进行面对面或线上咨询。",
                action_items=[
                    "预约心理咨询师",
                    "考虑进行专业的心理评估",
                    "遵循医生建议，必要时配合药物治疗",
                    "定期复诊，跟踪病情变化"
                ],
                timeframe="within_24_hours"
            ))
        
        recommendations.append(InterventionRecommendation(
            priority=3,
            category="social_support",
            title="建立社会支持网络",
            description="与信任的家人和朋友保持联系，分享您的感受。",
            action_items=[
                "每天至少与一位亲友交流",
                "加入心理健康支持小组",
                "参加社区活动或兴趣小组",
                "避免长时间独处"
            ],
            timeframe="ongoing"
        ))
        
        recommendations.append(InterventionRecommendation(
            priority=4,
            category="lifestyle",
            title="调整生活方式",
            description="健康的生活习惯对改善情绪有积极作用。",
            action_items=[
                "保持规律作息，每天睡眠7-8小时",
                "每天进行30分钟有氧运动",
                "保持均衡饮食，减少咖啡因和酒精摄入",
                "练习冥想或深呼吸放松",
                "减少社交媒体使用时间"
            ],
            timeframe="ongoing"
        ))
        
        if "文本内容包含较多消极词汇和绝望表达" in triggering_factors:
            recommendations.append(InterventionRecommendation(
                priority=5,
                category="thought_monitoring",
                title="关注消极思维",
                description="注意识别并挑战消极的自我对话。",
                action_items=[
                    "记录每天的消极想法",
                    "尝试用更客观的角度重新审视这些想法",
                    "练习感恩，每天记录三件值得感激的事",
                    "阅读积极心理学相关书籍"
                ],
                timeframe="daily"
            ))
        
        return sorted(recommendations, key=lambda x: x.priority)

    def _get_additional_resources(self) -> List[Dict[str, str]]:
        return [
            {
                "title": "中国心理卫生协会",
                "url": "http://www.camh.org.cn/",
                "type": "professional_organization"
            },
            {
                "title": "简单心理",
                "url": "https://www.jiandanxinli.com/",
                "type": "online_counseling"
            },
            {
                "title": "壹心理",
                "url": "https://www.xinli001.com/",
                "type": "online_counseling"
            },
            {
                "title": "抑郁症自测(SDS)",
                "url": "https://www.xinli001.com/ceshi/243",
                "type": "self_assessment"
            }
        ]

    def generate_intervention_report(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        custom_config: Optional[InterventionConfig] = None
    ) -> InterventionReport:
        start_time = time.time()
        logger.info(f"Generating intervention report for user {user_id}")
        
        config = custom_config or self.config
        
        trajectory = self.trend_predictor.build_history_trajectory(user_id)
        prediction = self.trend_predictor.predict_trend(user_id, prediction_horizon=3)
        
        current_score = prediction.key_indicators.get("current_score", 50.0)
        predicted_score = prediction.predictions[-1].predicted_score if prediction.predictions else current_score
        
        crisis_level = self._determine_crisis_level(
            current_score,
            prediction.overall_trend,
            predicted_score
        )
        
        triggering_factors = self._identify_triggering_factors(trajectory, prediction.model_dump())
        recommendations = self._generate_recommendations(crisis_level, triggering_factors)
        
        if crisis_level in [CrisisLevel.SEVERE, CrisisLevel.CRITICAL]:
            hotlines = self.get_all_hotlines(include_crisis_only=True)
        else:
            hotlines = self.get_all_hotlines(include_crisis_only=False)
        
        report_id = f"report_{uuid.uuid4().hex[:12]}"
        
        report = InterventionReport(
            report_id=report_id,
            user_id=user_id,
            session_id=session_id,
            generated_at=datetime.utcnow(),
            crisis_level=crisis_level,
            current_score=round(current_score, 2),
            score_trend=prediction.overall_trend,
            triggering_factors=triggering_factors,
            recommendations=recommendations,
            hotlines=hotlines,
            additional_resources=self._get_additional_resources()
        )
        
        try:
            self.db.save_intervention_report(report.model_dump())
            logger.info(f"Intervention report saved: {report_id}")
        except Exception as e:
            logger.warning(f"Failed to save intervention report: {e}")
        
        logger.info(
            f"Intervention report generated in {(time.time() - start_time)*1000:.2f}ms. "
            f"Crisis level: {crisis_level.value}"
        )
        
        return report

    def check_and_trigger_intervention(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        force_generate: bool = False
    ) -> Dict[str, Any]:
        if not self.config.enable_auto_intervention and not force_generate:
            return {
                "triggered": False,
                "reason": "Auto intervention disabled",
                "report": None
            }
        
        crisis_detection = self.trend_predictor.detect_sustained_rise(
            user_id,
            threshold=self.config.crisis_threshold,
            consecutive_count=self.config.sustained_rise_count
        )
        
        trajectory = self.trend_predictor.build_history_trajectory(user_id)
        current_score = trajectory.score_trend[-1].depression_score if trajectory.score_trend else 0
        
        is_crisis = current_score >= self.config.crisis_threshold or crisis_detection["detected"]
        
        if is_crisis or force_generate:
            report = self.generate_intervention_report(user_id, session_id)
            
            if is_crisis and self.config.enable_hotline_push:
                self._push_hotline_notification(user_id, report)
            
            return {
                "triggered": True,
                "is_crisis": is_crisis,
                "crisis_detection": crisis_detection,
                "report": report,
                "hotlines_pushed": self.config.enable_hotline_push and is_crisis
            }
        
        return {
            "triggered": False,
            "reason": "No crisis detected",
            "crisis_detection": crisis_detection,
            "current_score": current_score,
            "report": None
        }

    def _push_hotline_notification(self, user_id: str, report: InterventionReport):
        try:
            crisis_hotlines = [h for h in report.hotlines if h.is_crisis]
            
            notification = {
                "user_id": user_id,
                "report_id": report.report_id,
                "crisis_level": report.crisis_level.value,
                "hotlines": [h.model_dump() for h in crisis_hotlines],
                "timestamp": datetime.utcnow(),
                "channels": self.config.notification_channels,
                "message": "检测到您的抑郁评分处于较高风险水平。如果您正经历困难，请不要犹豫，立即拨打以下心理援助热线寻求帮助。"
            }
            
            logger.info(
                f"Hotline notification pushed for user {user_id}. "
                f"Crisis level: {report.crisis_level.value}, "
                f"Channels: {self.config.notification_channels}"
            )
            
            self.db.save_notification(notification)
            
        except Exception as e:
            logger.error(f"Failed to push hotline notification: {e}")

    def get_user_intervention_reports(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        try:
            return self.db.get_user_intervention_reports(user_id, limit)
        except Exception as e:
            logger.error(f"Failed to get intervention reports: {e}")
            return []

    def update_config(self, new_config: InterventionConfig):
        self.config = new_config
        logger.info("Intervention config updated")

    def get_config(self) -> Dict[str, Any]:
        return {
            "crisis_threshold": self.config.crisis_threshold,
            "sustained_rise_count": self.config.sustained_rise_count,
            "enable_auto_intervention": self.config.enable_auto_intervention,
            "enable_hotline_push": self.config.enable_hotline_push,
            "notification_channels": self.config.notification_channels,
            "custom_hotlines_count": len(self.config.custom_hotlines)
        }
