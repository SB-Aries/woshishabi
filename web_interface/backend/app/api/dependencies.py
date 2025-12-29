from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os
from pydantic import BaseModel
from .endpoints.auth import fake_users_db, verify_password

class User(BaseModel):
    id: int
    username: str
    hashed_password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    disabled: Optional[bool] = None

    class Config:
        from_attributes = True

# 配置
SECRET_KEY = os.getenv("SECRET_KEY", "a_very_long_and_secure_secret_key_here_32_chars")
ALGORITHM = "HS256"

# OAuth2密码承载令牌
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# 模拟用户数据库
fake_users_db = {
    "admin": {
        "id": 1,
        "username": "admin",
        "hashed_password": "admin",
        "full_name": "Administrator",
        "email": "admin@example.com",
        "disabled": False,
    },
    "user1": {
        "id": 2,
        "username": "user1",
        "hashed_password": "user1",
        "full_name": "User One",
        "email": "user1@example.com",
        "disabled": False,
    },
}

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials: invalid token or user not found",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = username
    except JWTError as e:
        raise credentials_exception from e
    
    user_dict = fake_users_db.get(username)
    if user_dict is None:
        raise credentials_exception
    
    return User(**user_dict)

def get_current_active_user(current_user: User = Depends(get_current_user)):
    """获取当前活跃用户"""
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return current_user

def get_current_admin_user(current_user: User = Depends(get_current_active_user)):
    """获取当前管理员用户"""
    if current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return current_user

# 辅助函数
def verify_password(plain_password, hashed_password):
    # 暂时使用简单的密码比较，后续可以替换为更安全的方案
    return plain_password == hashed_password

def get_password_hash(password):
    # 暂时返回明文密码，后续可以替换为更安全的方案
    return password

def authenticate_user(fake_db, username: str, password: str):
    user_dict = fake_db.get(username)
    if not user_dict:
        return False
    user = User(**user_dict)
    if not verify_password(password, user.hashed_password):
        return False
    return user

# OAuth2密码承载令牌
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")