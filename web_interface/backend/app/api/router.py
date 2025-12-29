from fastapi import APIRouter
from .endpoints import auth, projects, tasks, reports, tools, settings

router = APIRouter()

# 包含认证路由
router.include_router(auth.router)

# 包含项目路由（使用实际实现的projects.py，而非模拟的project.py）
router.include_router(projects.router)

# 包含任务路由
router.include_router(tasks.router)

# 包含报告路由
router.include_router(reports.router)

# 包含工具路由
router.include_router(tools.router)

# 包含设置路由
router.include_router(settings.router)

# 未来可以添加更多路由，如：
# router.include_router(help.router)
