from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from ..dependencies import get_current_user, User
from ...database import get_db
from ...models.project import Project

router = APIRouter(
    prefix="/projects",
    tags=["projects"]
)

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_competitive: bool = False
    status: str = "active"

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_competitive: Optional[bool] = None
    status: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """创建新项目"""
    db_project = Project(
        name=project.name,
        description=project.description,
        is_competitive=project.is_competitive,
        status=project.status,
        created_by=current_user.id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectResponse])
def read_projects(
    skip: int = 0,
    limit: int = 10,
    id: Optional[int] = Query(None, description="项目ID"),
    name: Optional[str] = Query(None, description="项目名称"),
    is_competitive: Optional[bool] = Query(None, description="是否竞争性项目"),
    status: Optional[str] = Query(None, description="项目状态"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取项目列表，支持筛选"""
    query = db.query(Project)
    
    if id:
        query = query.filter(Project.id == id)
    if name:
        query = query.filter(Project.name.contains(name))
    if is_competitive is not None:
        query = query.filter(Project.is_competitive == is_competitive)
    if status:
        query = query.filter(Project.status == status)
    
    return query.offset(skip).limit(limit).all()

@router.get("/{project_id}", response_model=ProjectResponse)
def read_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """获取单个项目详情"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新项目信息"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    if db_project.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="只有项目创建人可以修改项目")
    
    update_data = project.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_project, field, value)
    
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """删除项目"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    if project.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="只有项目创建人可以删除项目")
    
    # The cascade relationships should handle deleting tasks and reports
    db.delete(project)
    db.commit()
    return {"message": "项目删除成功"}