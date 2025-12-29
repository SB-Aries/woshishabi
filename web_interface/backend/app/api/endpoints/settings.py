from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...database import get_db
from ...models.user import User
from ..endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(
    prefix="/settings",
    tags=["settings"]
)

# Pydantic models
class SettingBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SettingResponse(SettingBase):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True

# Routes
@router.get("/", response_model=List[SettingResponse])
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # For now, return some default settings
    default_settings = [
        {
            "id": 1,
            "key": "scan_timeout",
            "value": "3600",
            "description": "Scan timeout in seconds",
            "created_at": "2023-01-01T00:00:00",
            "updated_at": "2023-01-01T00:00:00"
        },
        {
            "id": 2,
            "key": "scan_threads",
            "value": "5",
            "description": "Number of scan threads",
            "created_at": "2023-01-01T00:00:00",
            "updated_at": "2023-01-01T00:00:00"
        },
        {
            "id": 3,
            "key": "report_format",
            "value": "html",
            "description": "Default report format",
            "created_at": "2023-01-01T00:00:00",
            "updated_at": "2023-01-01T00:00:00"
        }
    ]
    return default_settings

@router.put("/{setting_id}", response_model=SettingResponse)
def update_setting(setting_id: int, setting: SettingBase, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # For now, return the updated setting
    return {
        "id": setting_id,
        "key": setting.key,
        "value": setting.value,
        "description": setting.description,
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-12-20T00:00:00"
    }
