1. 项目概述
本项目是一个基于WapitiCore的Web漏洞扫描器，提供了完整的前后端架构，支持漏洞扫描、端口扫描和多种安全工具集成。系统采用现代化的技术栈，具有良好的可扩展性和教学价值。
1.1 主要功能
● 漏洞扫描：集成WapitiCore实现主动和被动漏洞扫描
● 端口扫描：支持TCP全连接扫描，可配置端口范围和并发数
● 安全工具集：提供URL验证、IP验证、密码生成、Base64编解码等辅助工具
● 用户认证：基于JWT的身份验证和授权机制
● 主题切换：支持亮色、暗色和Kuromi主题
● 报告生成：漏洞扫描结果以JSON格式输出，便于分析和处理
2. 技术栈
2.1 前端技术栈
技术	版本	用途
React	18	前端框架
Ant Design	5.x	UI组件库
Vite	4.x	构建工具
React Router	6.x	路由管理
Axios	1.x	HTTP客户端
2.2 后端技术栈
技术	版本	用途
FastAPI	0.95.x	Web框架
SQLAlchemy	2.x	ORM
JWT	2.7.x	身份认证
Pydantic	2.x	数据验证
Asyncio	-	异步编程
ThreadPoolExecutor	-	并发处理
2.3 安全技术
技术	用途
WapitiCore	漏洞扫描引擎
TCP全连接扫描	端口检测
CORS配置	跨域资源共享安全
JWT令牌	无状态认证
3. 系统架构
3.1 整体架构
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│    前端应用       │     │    后端API        │     │   漏洞扫描引擎    │
│  (React + AntD)   │────▶│  (FastAPI)        │────▶│  (WapitiCore)     │
└───────────────────┘     └───────────────────┘     └───────────────────┘
         ▲                        │
         │                        │
         └────────────────────────┘
               认证与授权
3.2 模块划分
3.2.1 前端模块
● 认证模块：登录、注册、令牌管理
● 项目管理：项目创建、编辑、删除
● 任务管理：扫描任务配置、执行、监控
● 报告模块：扫描结果展示、导出
● 工具模块：安全工具集集成
● 设置模块：用户配置、主题切换
3.2.2 后端模块
● API路由：RESTful接口定义
● 认证服务：JWT生成、验证、刷新
● 漏洞扫描服务：WapitiCore集成、扫描控制
● 端口扫描服务：TCP扫描、并发控制
● 工具服务：安全工具实现
● 数据持久化：用户、项目、任务数据存储
4. 核心模块实现
4.1 漏洞扫描模块
4.1.1 WapitiCore集成
代码位置：/Users/aries/Downloads/wapiti-master/web_interface/backend/app/api/endpoints/tools.py
# 添加WapitiCore到Python路径
wapiti_root = Path("/Users/aries/Downloads/wapiti-master")
sys.path.insert(0, str(wapiti_root))

import wapitiCore
from wapitiCore.controller.wapiti import Wapiti
from wapitiCore.net import Request
from wapitiCore.attack.modules.core import resolve_module_settings
from wapitiCore.main.log import configure as configure_logging
from wapitiCore.report import jsonreportgenerator
4.1.2 扫描流程实现
漏洞扫描核心逻辑：
async def run_scan():
    # 配置日志
    configure_logging(level=1)  # INFO level
    
    # 创建Wapiti实例
    base_request = Request(tool_request.target_url)
    wapiti = Wapiti(
        base_request, 
        scope="folder",
        session_dir=None,  # 使用临时目录
        config_dir=None     # 使用默认配置目录
    )
    
    # 设置扫描参数
    modules = tool_request.options.get("modules", "all")
    is_passive = tool_request.options.get("passive", False)
    
    # 解析模块设置
    activated_modules = resolve_module_settings(modules)
    
    # 设置模块
    wapiti.active_scanner.set_modules(activated_modules)
    wapiti.passive_scaner.set_modules(activated_modules)
    
    # 设置基本选项
    wapiti.set_timeout(10.0)
    wapiti.set_verify_ssl(False)  # 暂时不验证SSL
    
    # 初始化persister
    await wapiti.init_persister()
    
    # 加载扫描状态
    await wapiti.load_scan_state()
    
    # 创建停止事件
    stop_event = asyncio.Event()
    
    # 浏览网站
    await wapiti.browse(stop_event)
    
    # 如果不是被动扫描，运行攻击
    if not is_passive:
        await wapiti.active_scanner.attack()
    
    # 生成JSON报告
    report_gen = jsonreportgenerator.JsonReportGenerator()
    report_gen.set_report_info(
        target=tool_request.target_url,
        scope="folder",
        date=wapiti.persister.start_time if hasattr(wapiti.persister, 'start_time') else None,
        version=f"Wapiti {wapitiCore.WAPITI_VERSION}",
        auth=None,
        crawled_pages=[],
        crawled_pages_nbr=await wapiti.count_resources(),
        detailed_report_level=0
    )
    
    # 获取漏洞信息
    async for vulnerability in wapiti.persister.get_vulnerabilities():
        report_gen.add_vulnerability(
            category=vulnerability.category,
            level=vulnerability.level,
            request=vulnerability.request,
            parameter=vulnerability.parameter,
            info=vulnerability.info,
            module=vulnerability.module,
            wstg=vulnerability.wstg,
            response=vulnerability.response
        )
    
    # 生成报告内容
    import io
    buffer = io.StringIO()
    report_gen.generate_report(buffer)
    buffer.seek(0)
    scan_result = buffer.read()
    
    return scan_result
4.1.3 扫描模块配置
Wapiti支持多种漏洞扫描模块，包括：
● SQL注入检测
● XSS检测
● CSRF检测
● 文件包含检测
● 命令注入检测
● 目录遍历检测
● 服务器端请求伪造检测
可以通过modules参数配置要启用的扫描模块：
# 解析模块设置
activated_modules = resolve_module_settings(modules)

# 设置模块
wapiti.active_scanner.set_modules(activated_modules)
wapiti.passive_scaner.set_modules(activated_modules)
4.2 端口扫描模块
4.2.1 端口范围解析
代码位置：/Users/aries/Downloads/wapiti-master/web_interface/backend/app/api/endpoints/tools.py
def parse_port_ranges(port_str: str) -> List[int]:
    """解析端口范围字符串，支持单个端口、范围和逗号分隔列表"""
    ports = []
    for part in port_str.split(','):
        part = part.strip()
        if '-' in part:
            # 处理范围，例如 "80-90"
            start, end = map(int, part.split('-'))
            if 1 <= start <= end <= 65535:
                ports.extend(range(start, end + 1))
            else:
                raise ValueError(f"Invalid port range: {part}")
        else:
            # 处理单个端口
            port = int(part)
            if 1 <= port <= 65535:
                ports.append(port)
            else:
                raise ValueError(f"Invalid port: {port}")
    
    # 限制端口数量以防止滥用
    if len(ports) > 1000:
        raise ValueError("Too many ports specified. Maximum 1000 ports allowed.")
    
    return ports
4.2.2 TCP端口扫描实现
def tcp_port_scan(target: str, port: int, timeout: float) -> Dict[str, Any]:
    """执行TCP连接扫描"""
    try:
        import time
        start_time = time.time()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((target, port))
        end_time = time.time()
        sock.close()
        
        is_open = result == 0
        response_time = round((end_time - start_time) * 1000, 2)  # 转换为毫秒
        
        return {
            "port": port,
            "open": is_open,
            "service": "unknown" if is_open else "closed",
            "response_time": response_time
        }
    except Exception as e:
        return {
            "port": port,
            "open": False,
            "service": "error",
            "response_time": -1,
            "error": str(e)
        }
4.2.3 并发扫描控制
async def perform_port_scan(target: str, ports: List[int], scan_type: str, timeout: float, max_concurrent: int) -> List[Dict[str, Any]]:
    """执行端口扫描，支持TCP全连接扫描"""
    results = []
    
    # 验证目标主机格式
    try:
        socket.gethostbyname(target)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Invalid target host")
    
    # 只支持TCP扫描（SYN扫描需要root权限，这里不实现以保证安全）
    if scan_type.lower() == "syn":
        # 提醒用户SYN扫描需要特殊权限
        return [{
            "warning": "SYN scan requires root/administrator privileges and was not executed for security reasons. Using TCP scan instead."
        }]
    
    # 使用线程池执行TCP扫描
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_concurrent) as executor:
        tasks = [
            loop.run_in_executor(executor, tcp_port_scan, target, port, timeout)
            for port in ports
        ]
        results = await asyncio.gather(*tasks)
    
    # 过滤掉警告信息
    results = [r for r in results if "warning" not in r]
    
    # 只返回开放的端口
    open_ports = [r for r in results if r.get("open")]
    
    return open_ports
4.3 用户认证模块
4.3.1 JWT令牌生成
代码位置：/Users/aries/Downloads/wapiti-master/web_interface/backend/app/api/endpoints/auth.py
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
4.3.2 令牌验证与刷新
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
        
        # 验证令牌类型和用户名
        if username is None or token_type != "refresh":
            raise credentials_exception
            
        user = get_user(fake_users_db, username=username)
        if user is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
        
    # 创建新的访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
4.4 前端API集成
4.4.1 认证状态管理
代码位置：/Users/aries/Downloads/wapiti-master/web_interface/frontend/src/App.jsx
// 用户认证状态
const [user, setUser] = useState(null);
// 初始状态直接从localStorage获取token，避免初始渲染时重定向问题
const [token, setToken] = useState(localStorage.getItem('token'));
const [loading, setLoading] = useState(true);

// 当token存在时获取当前用户信息
useEffect(() => {
    const fetchCurrentUser = async () => {
        if (token) {
            try {
                const userData = await getCurrentUser();
                setUser(userData);
            } catch (error) {
                console.error('Failed to fetch current user:', error);
                // 如果获取用户信息失败，可能是token无效，清除token
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
            }
        } else {
            setUser(null);
        }
        setLoading(false);
    };

    fetchCurrentUser();
}, [token]);
4.4.2 Axios请求拦截器
代码位置：/Users/aries/Downloads/wapiti-master/web_interface/frontend/src/utils/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 请求拦截器
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    response => {
        return response;
    },
    async error => {
        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refreshToken');
                const response = await axios.post('http://localhost:8000/api/auth/refresh', {
                    refresh_token: refreshToken
                });
                const newToken = response.data.access_token;
                localStorage.setItem('token', newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // 刷新令牌失败，清除本地存储并跳转到登录页面
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);
5. 系统安全配置
5.1 CORS配置
代码位置：/Users/aries/Downloads/wapiti-master/web_interface/backend/app/main.py
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 只允许前端域名访问，避免跨域漏洞
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
5.2 JWT安全配置
# JWT配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 访问令牌有效期30分钟
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 刷新令牌有效期7天
注意：在生产环境中，应使用环境变量设置安全的SECRET_KEY，避免硬编码。
5.3 输入验证
系统使用Pydantic模型进行输入验证，确保API请求参数的有效性：
class PortScanRequest(BaseModel):
    target: str
    ports: str  # 可以是单个端口、范围或逗号分隔的列表
    scan_type: str = "tcp"  # tcp (full connect) or syn (stealth)
    timeout: float = 1.0
    max_concurrent: int = 50
    service_detection: bool = True
5.4 资源限制
为防止滥用，系统对端口扫描的端口数量进行了限制：
# 限制端口数量以防止滥用
if len(ports) > 1000:
    raise ValueError("Too many ports specified. Maximum 1000 ports allowed.")
6. 开发与部署
6.1 开发环境搭建
6.1.1 后端环境
# 安装依赖
cd /Users/aries/Downloads/wapiti-master/web_interface/backend
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
6.1.2 前端环境
# 安装依赖
cd /Users/aries/Downloads/wapiti-master/web_interface/frontend
npm install

# 启动开发服务器
npm run dev
6.2 生产部署
6.2.1 前端构建
# 构建前端应用
cd /Users/aries/Downloads/wapiti-master/web_interface/frontend
npm run build
6.2.2 后端部署
使用Gunicorn或Uvicorn部署后端应用：
# 使用Uvicorn部署
cd /Users/aries/Downloads/wapiti-master/web_interface/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
7. 测试与调试
7.1 漏洞扫描测试
# 使用curl测试漏洞扫描API
curl -X POST "http://localhost:8000/api/tools/run" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_TOKEN" \
-d '{"tool_name": "wapiti_scan", "target_url": "http://example.com", "options": {"modules": "all", "passive": false}}'
7.2 端口扫描测试
# 使用curl测试端口扫描API
curl -X POST "http://localhost:8000/api/tools/port-scan" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_TOKEN" \
-d '{"target": "127.0.0.1", "ports": "80,443,8000-8010", "scan_type": "tcp", "timeout": 1.0, "max_concurrent": 50}'
7.3 调试技巧
1. 前端调试：使用Chrome DevTools检查网络请求和组件状态
2. 后端调试：设置FastAPI的调试模式，查看详细的错误信息
3. Wapiti日志：配置Wapiti的日志级别，查看扫描过程的详细日志
8. 常见问题与解决方案
8.1 CORS跨域问题
问题：前端无法访问后端API，浏览器报CORS错误
解决方案：在FastAPI中正确配置CORS中间件，确保allow_origins包含前端域名：
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
8.2 JWT令牌过期
问题：API请求返回401错误，提示令牌过期
解决方案：实现令牌刷新机制，当访问令牌过期时，使用刷新令牌获取新的访问令牌：
// 响应拦截器
api.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refreshToken');
                const response = await axios.post('http://localhost:8000/api/auth/refresh', {
                    refresh_token: refreshToken
                });
                const newToken = response.data.access_token;
                localStorage.setItem('token', newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);
8.3 端口扫描性能问题
问题：端口扫描速度慢，特别是扫描大量端口时
解决方案：
1. 增加并发数：调整max_concurrent参数，增加并发扫描线程数
2. 减少超时时间：调整timeout参数，减少每个端口的扫描超时时间
3. 限制端口数量：避免一次扫描过多端口，建议分批扫描
8.4 主题切换问题
问题：Kuromi主题的背景图片不显示
解决方案：检查Vite配置，确保静态资源路径配置正确：
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 移除错误的别名配置
})
开发日志作者：Aries
完成日期：2025-12-23
版本：1.0.0


