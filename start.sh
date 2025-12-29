#!/bin/bash

echo "启动漏洞扫描系统..."

# 启动后端服务
echo "启动后端服务..."
cd web_interface/backend
nohup uvicorn app.main:app --reload > backend.log 2>&1 &
BACKEND_PID=$!
echo "后端服务已启动，PID: $BACKEND_PID"

# 等待后端启动并校验
sleep 3
if lsof -i :8000 >/dev/null 2>&1; then
    echo "后端服务端口 8000 已监听，启动成功"
else
    echo "后端服务端口 8000 未监听，启动失败"
    exit 1
fi

# 启动前端服务
echo "启动前端服务..."
cd ../frontend
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端服务已启动，PID: $FRONTEND_PID"

# 等待前端启动并校验
sleep 5
if lsof -i :3000 >/dev/null 2>&1; then
    echo "前端服务端口 3000 已监听，启动成功"
else
    echo "前端服务端口 3000 未监听，启动失败"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 保存PID到文件
echo $BACKEND_PID > ../backend.pid
echo $FRONTEND_PID > ../frontend.pid

echo "系统启动完成！"
echo "前端地址: http://localhost:3000"
echo "后端地址: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
