#!/bin/bash

echo "[*]停止漏洞扫描系统..."

# 停止后端服务
if [ -f web_interface/backend.pid ]; then
    BACKEND_PID=$(cat web_interface/backend.pid)
    if kill $BACKEND_PID; then
        rm web_interface/backend.pid
        echo "[+]后端服务已停止，PID: $BACKEND_PID"
    else
        echo "[-]无法停止后端服务，PID: $BACKEND_PID"
    fi
else
    echo "[-]未找到后端服务PID文件"
fi

# 停止前端服务
if [ -f web_interface/frontend.pid ]; then
    FRONTEND_PID=$(cat web_interface/frontend.pid)
    if kill $FRONTEND_PID; then
        rm web_interface/frontend.pid
        echo "[+]前端服务已停止，PID: $FRONTEND_PID"
    else
        echo "[-]无法停止前端服务，PID: $FRONTEND_PID"
    fi  
else
    echo "[-]未找到前端服务PID文件"
fi

# 清理残留进程
pkill -f "uvicorn app.main:app"
pkill -f "npm run dev"

echo "[+]系统停止完成！"
