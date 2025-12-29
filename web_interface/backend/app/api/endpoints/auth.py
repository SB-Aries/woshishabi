from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional
import os

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

## 配置
SECRET_KEY = os.getenv("SECRET_KEY", "a_very_long_and_secure_secret_key_here_32_chars")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 恢复为30分钟
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 新增：刷新令牌有效期为7天

# 密码加密上下文 - 使用PBKDF2替代bcrypt以支持更长密码
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# OAuth2密码承载令牌
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# 模拟用户数据库
# 使用PBKDF2哈希存储密码
fake_users_db = {
    "admin": {
        "id": 1,
        "username": "admin",
        "hashed_password": "$pbkdf2-sha256$29000$bw1hLGUMYezdG8N4r7V2rg$WbRS11t4ILnkGuNj1Kfljn3SHQ/AjGvl3CB5uKnVRAI",  # 密码: admin
        "full_name": "Administrator",
        "email": "admin@example.com",
        "disabled": False,
    },
    "user1": {
        "id": 2,
        "username": "user1",
        "hashed_password": "$pbkdf2-sha256$29000$.3/vnZPynvPe.x.jFGIMwQ$W4nXE70F/ahdvdO/QhR31Dgb4JaLsL4x/WnDKkS4srY",  # 密码: user1
        "full_name": "User One",
        "email": "user1@example.com",
        "disabled": False,
    },
}

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class User(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

# 辅助函数
def verify_password(plain_password, hashed_password):
    """验证密码是否正确"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """生成密码的哈希值"""
    return pwd_context.hash(password)

def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)

def authenticate_user(fake_db, username: str, password: str):
    user = get_user(fake_db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict):
    """创建刷新令牌"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: UserInDB = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# API端点
@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """用户登录获取访问令牌和刷新令牌"""
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    # 创建刷新令牌
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """获取当前用户信息"""
    return current_user

@router.get("/users/me/items/")
async def read_own_items(current_user: User = Depends(get_current_active_user)):
    """获取当前用户的项目"""
    return [{"item_id": "Foo", "owner": current_user.username}]

@router.post("/refresh")
async def refresh_access_token(refresh_token_request: RefreshTokenRequest):
    """使用刷新令牌获取新的访问令牌"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(refresh_token_request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        if username is None or token_type != "refresh":
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    # 创建新的访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    # 可以选择返回新的刷新令牌（可选）
    return {"access_token": access_token, "token_type": "bearer"}