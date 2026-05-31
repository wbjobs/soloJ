from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class BoundingBox(BaseModel):
    min_x: float
    max_x: float
    min_y: float
    max_y: float
    min_z: float
    max_z: float


class SelectionRequest(BaseModel):
    pointcloud_name: str
    bounding_box: BoundingBox
    description: Optional[str] = None


class SelectionResponse(BaseModel):
    id: int
    pointcloud_name: str
    point_count: int
    average_height: float
    volume: float
    bounding_box: BoundingBox
    created_at: datetime
    description: Optional[str] = None

    class Config:
        from_attributes = True


class PointCloudInfo(BaseModel):
    name: str
    point_count: int
    bounds: BoundingBox
    has_color: bool
