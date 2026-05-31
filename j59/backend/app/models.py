from sqlalchemy import Column, Integer, Float, String, DateTime, JSON
from datetime import datetime
from .database import Base


class SelectionResult(Base):
    __tablename__ = "selection_results"

    id = Column(Integer, primary_key=True, index=True)
    pointcloud_name = Column(String, index=True)
    point_count = Column(Integer)
    average_height = Column(Float)
    volume = Column(Float)
    bounding_box = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(String, nullable=True)
