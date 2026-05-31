from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import router as pointcloud_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="3D Point Cloud Editor API",
    description="LAS/LAZ point cloud visualization and analysis service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pointcloud_router)


@app.get("/")
def root():
    return {
        "name": "3D Point Cloud Editor API",
        "version": "1.0.0",
        "endpoints": {
            "list_pointclouds": "GET /api/pointclouds",
            "get_pointcloud_info": "GET /api/pointclouds/{name}",
            "get_pointcloud_tile": "GET /api/pointclouds/{name}/tile",
            "compute_stats": "POST /api/pointclouds/{name}/compute-stats",
            "save_selection": "POST /api/selection",
            "get_selections": "GET /api/selection",
            "upload": "POST /api/upload",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
