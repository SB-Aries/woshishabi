from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.router import router
from .database import engine, Base

# Import all models to ensure SQLAlchemy detects them
from . import models

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Aries Web Interface API",
    description="API for Aries Vulnerability Scanner Web Interface",
    version="1.0.0"
    #docs_url=None,  # 隐藏Swagger UI文档
    #redoc_url=None  # 隐藏ReDoc文档
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 只允许前端域名访问，避免跨域漏洞
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to Aries Web Interface API"}
