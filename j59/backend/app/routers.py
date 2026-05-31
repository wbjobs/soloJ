from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import shutil
import laspy
import numpy as np
from .database import get_db
from .models import SelectionResult
from .schemas import (
    BoundingBox,
    SelectionRequest,
    SelectionResponse,
    PointCloudInfo,
)
from .pointcloud_service import (
    list_pointclouds,
    get_pointcloud_info,
    get_pointcloud_tile,
    compute_selection_stats,
    UPLOAD_DIR,
    DATA_DIR,
    get_pointcloud_path,
)
from .octree import get_or_build_octree
from .classification import (
    get_classification_rules,
    classify_by_rgb,
    classify_by_intensity,
    get_class_statistics,
)

router = APIRouter(prefix="/api", tags=["pointcloud"])


class ViewFrustumRequest(BaseModel):
    camera_x: float
    camera_y: float
    camera_z: float
    max_screen_error: float = 2.0
    max_nodes: int = 50


@router.get("/pointclouds", response_model=List[PointCloudInfo])
def get_pointcloud_list():
    """获取所有可用的点云文件列表"""
    return list_pointclouds()


@router.get("/pointclouds/{name}", response_model=PointCloudInfo)
def get_pointcloud_info_endpoint(name: str):
    """获取指定点云的基本信息"""
    info = get_pointcloud_info(name)
    if info is None:
        raise HTTPException(status_code=404, detail="Point cloud not found")
    return info


@router.get("/pointclouds/{name}/tile")
def get_pointcloud_tile_endpoint(
    name: str,
    min_x: Optional[float] = None,
    max_x: Optional[float] = None,
    min_y: Optional[float] = None,
    max_y: Optional[float] = None,
    min_z: Optional[float] = None,
    max_z: Optional[float] = None,
    max_points: int = 500000,
    lod: int = 0,
):
    """获取点云切片数据"""
    bounds = None
    if all(v is not None for v in [min_x, max_x, min_y, max_y, min_z, max_z]):
        bounds = BoundingBox(
            min_x=min_x, max_x=max_x,
            min_y=min_y, max_y=max_y,
            min_z=min_z, max_z=max_z,
        )
    
    tile = get_pointcloud_tile(name, bounds, max_points, lod)
    if tile is None:
        raise HTTPException(status_code=404, detail="Point cloud not found")
    return tile


@router.post("/pointclouds/{name}/compute-stats")
def compute_stats_endpoint(name: str, bounds: BoundingBox):
    """计算选定区域的统计信息"""
    stats = compute_selection_stats(name, bounds)
    if stats is None:
        raise HTTPException(status_code=404, detail="Point cloud not found")
    return stats


@router.post("/selection", response_model=SelectionResponse)
def save_selection(
    request: SelectionRequest,
    db: Session = Depends(get_db),
):
    """保存选择结果到数据库"""
    stats = compute_selection_stats(request.pointcloud_name, request.bounding_box)
    if stats is None:
        raise HTTPException(status_code=404, detail="Point cloud not found")
    
    db_selection = SelectionResult(
        pointcloud_name=request.pointcloud_name,
        point_count=stats["point_count"],
        average_height=stats["average_height"],
        volume=stats["volume"],
        bounding_box={
            "min_x": request.bounding_box.min_x,
            "max_x": request.bounding_box.max_x,
            "min_y": request.bounding_box.min_y,
            "max_y": request.bounding_box.max_y,
            "min_z": request.bounding_box.min_z,
            "max_z": request.bounding_box.max_z,
        },
        description=request.description,
    )
    
    db.add(db_selection)
    db.commit()
    db.refresh(db_selection)
    
    return SelectionResponse(
        id=db_selection.id,
        pointcloud_name=db_selection.pointcloud_name,
        point_count=db_selection.point_count,
        average_height=db_selection.average_height,
        volume=db_selection.volume,
        bounding_box=BoundingBox(**db_selection.bounding_box),
        created_at=db_selection.created_at,
        description=db_selection.description,
    )


@router.get("/selection", response_model=List[SelectionResponse])
def get_selections(db: Session = Depends(get_db)):
    """获取所有保存的选择结果"""
    selections = db.query(SelectionResult).order_by(SelectionResult.created_at.desc()).all()
    return [
        SelectionResponse(
            id=s.id,
            pointcloud_name=s.pointcloud_name,
            point_count=s.point_count,
            average_height=s.average_height,
            volume=s.volume,
            bounding_box=BoundingBox(**s.bounding_box),
            created_at=s.created_at,
            description=s.description,
        )
        for s in selections
    ]


@router.get("/selection/{id}", response_model=SelectionResponse)
def get_selection(id: int, db: Session = Depends(get_db)):
    """获取单个选择结果"""
    selection = db.query(SelectionResult).filter(SelectionResult.id == id).first()
    if selection is None:
        raise HTTPException(status_code=404, detail="Selection not found")
    return SelectionResponse(
        id=selection.id,
        pointcloud_name=selection.pointcloud_name,
        point_count=selection.point_count,
        average_height=selection.average_height,
        volume=selection.volume,
        bounding_box=BoundingBox(**selection.bounding_box),
        created_at=selection.created_at,
        description=selection.description,
    )


@router.delete("/selection/{id}")
def delete_selection(id: int, db: Session = Depends(get_db)):
    """删除选择结果"""
    selection = db.query(SelectionResult).filter(SelectionResult.id == id).first()
    if selection is None:
        raise HTTPException(status_code=404, detail="Selection not found")
    db.delete(selection)
    db.commit()
    return {"message": "Selection deleted successfully"}


@router.post("/upload")
async def upload_pointcloud(file: UploadFile = File(...)):
    """上传 LAS/LAZ 点云文件"""
    if not file.filename.endswith(('.las', '.laz')):
        raise HTTPException(
            status_code=400,
            detail="Only LAS and LAZ files are allowed"
        )
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    data_path = os.path.join(DATA_DIR, file.filename)
    shutil.move(file_path, data_path)
    
    name = os.path.splitext(file.filename)[0]
    info = get_pointcloud_info(name)
    
    return {
        "message": "File uploaded successfully",
        "filename": file.filename,
        "info": info,
    }


@router.get("/pointclouds/{name}/octree/info")
def get_octree_info(name: str):
    """获取点云八叉树结构信息"""
    las_path = get_pointcloud_path(name)
    if not os.path.exists(las_path):
        raise HTTPException(status_code=404, detail="Point cloud not found")
    
    try:
        octree = get_or_build_octree(name, las_path, DATA_DIR)
        return octree.get_hierarchy_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pointclouds/{name}/octree/visible-nodes")
def get_visible_nodes(name: str, request: ViewFrustumRequest):
    """根据相机位置获取可见的八叉树节点列表"""
    las_path = get_pointcloud_path(name)
    if not os.path.exists(las_path):
        raise HTTPException(status_code=404, detail="Point cloud not found")
    
    try:
        octree = get_or_build_octree(name, las_path, DATA_DIR)
        node_ids = octree.get_nodes_for_view(
            camera_pos=(request.camera_x, request.camera_y, request.camera_z),
            max_screen_error=request.max_screen_error,
            max_nodes=request.max_nodes
        )
        return {"node_ids": node_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pointclouds/{name}/octree/node/{node_id}")
def get_octree_node(name: str, node_id: str):
    """获取八叉树指定节点的点云数据"""
    las_path = get_pointcloud_path(name)
    if not os.path.exists(las_path):
        raise HTTPException(status_code=404, detail="Point cloud not found")
    
    try:
        octree = get_or_build_octree(name, las_path, DATA_DIR)
        node_data = octree.get_node_data(name, node_id)
        if node_data is None:
            raise HTTPException(status_code=404, detail="Node not found")
        return node_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/classification/rules")
def get_classification_rules_endpoint():
    """获取点云分类规则列表"""
    return {"rules": get_classification_rules()}


class ClassifyRequest(BaseModel):
    method: str = "rgb"
    bounds: Optional[BoundingBox] = None


@router.post("/pointclouds/{name}/classify")
def classify_pointcloud(name: str, request: ClassifyRequest):
    """
    对点云进行分类
    
    method: 'rgb' 或 'intensity'
    """
    las_path = get_pointcloud_path(name)
    if not os.path.exists(las_path):
        raise HTTPException(status_code=404, detail="Point cloud not found")
    
    try:
        las = laspy.read(las_path)
        
        x = np.array(las.x, dtype=np.float32)
        y = np.array(las.y, dtype=np.float32)
        z = np.array(las.z, dtype=np.float32)
        
        indices = np.arange(len(x))
        if request.bounds:
            mask = (
                (x >= request.bounds.min_x) & (x <= request.bounds.max_x) &
                (y >= request.bounds.min_y) & (y <= request.bounds.max_y) &
                (z >= request.bounds.min_z) & (z <= request.bounds.max_z)
            )
            indices = indices[mask]
        
        classifications = None
        intensities = None
        
        if request.method == "rgb":
            if 'red' not in las.point_format.dimension_names:
                raise HTTPException(
                    status_code=400,
                    detail="Point cloud does not have RGB color information"
                )
            
            r = np.array(las.red[indices], dtype=np.float32)
            g = np.array(las.green[indices], dtype=np.float32)
            b = np.array(las.blue[indices], dtype=np.float32)
            
            classifications = classify_by_rgb(r, g, b)
            
        elif request.method == "intensity":
            if 'intensity' not in las.point_format.dimension_names:
                raise HTTPException(
                    status_code=400,
                    detail="Point cloud does not have intensity information"
                )
            
            intensity = np.array(las.intensity[indices], dtype=np.float32)
            intensities = intensity.copy()
            z_values = z[indices]
            
            classifications = classify_by_intensity(intensity, z_values)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown classification method: {request.method}"
            )
        
        stats = get_class_statistics(classifications, intensities)
        
        return {
            "method": request.method,
            "point_count": len(classifications),
            "statistics": stats,
            "classifications": classifications.tolist(),
            "bounds": request.bounds.dict() if request.bounds else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pointclouds/{name}/classification")
def get_pointcloud_classification(
    name: str,
    method: str = "rgb",
    min_x: Optional[float] = None,
    max_x: Optional[float] = None,
    min_y: Optional[float] = None,
    max_y: Optional[float] = None,
    min_z: Optional[float] = None,
    max_z: Optional[float] = None,
):
    """获取点云分类结果（GET 接口）"""
    bounds = None
    if all(v is not None for v in [min_x, max_x, min_y, max_y, min_z, max_z]):
        bounds = BoundingBox(
            min_x=min_x, max_x=max_x,
            min_y=min_y, max_y=max_y,
            min_z=min_z, max_z=max_z,
        )
    
    request = ClassifyRequest(method=method, bounds=bounds)
    return classify_pointcloud(name, request)
