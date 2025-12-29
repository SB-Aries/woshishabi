from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import subprocess
import json
import asyncio
import os
import sys
from pathlib import Path
import tempfile

# Wapiti modules will be imported inside the functions to avoid import issues on Windows
import os
from datetime import datetime
from fastapi.responses import FileResponse

from ...database import get_db
from ...models.user import User
from ..endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(
    prefix="/tools",
    tags=["tools"]
)

# Pydantic models
class ToolRequest(BaseModel):
    tool_name: str
    target_url: str
    options: dict = {}

class ToolResponse(BaseModel):
    tool_name: str
    result: str

# Pydantic models for new endpoints
class UrlCheckRequest(BaseModel):
    url: str

class IpValidateRequest(BaseModel):
    ip: str

class GeneratePasswordRequest(BaseModel):
    length: int = 12
    options: dict = {}

class Base64Request(BaseModel):
    text: str

# Routes
@router.post("/run", response_model=ToolResponse)
def run_tool(tool_request: ToolRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Set up Python path to ensure wapitiCore can be imported in Windows spawn processes
    import sys
    from pathlib import Path
    
    # Get project root directory dynamically
    project_root = Path(__file__).parent.parent.parent.parent.parent
    wapiti_root = project_root
    
    # Add project root to Python path if not already there
    if str(wapiti_root) not in sys.path:
        sys.path.insert(0, str(wapiti_root))
    
    # Import wapitiCore modules inside the function to avoid import issues on Windows
    import wapitiCore
    from wapitiCore.controller.wapiti import Wapiti
    from wapitiCore.net import Request
    from wapitiCore.attack.modules.core import resolve_module_settings
    from wapitiCore.main.log import configure as configure_logging
    from wapitiCore.report import jsonreportgenerator
    from wapitiCore.net import jsoncookie
    from wapitiCore.net.crawler import AsyncCrawler
    from wapitiCore.net.classes import CrawlerConfiguration
    from wapitiCore.net.auth import login_with_raw_data, async_fetch_login_page
    from wapitiCore.parsers.html_parser import Html
    from wapitiCore.report.htmlreportgenerator import HTMLReportGenerator
    
    try:
        if tool_request.tool_name == "wapiti_getcookie":
            # 使用wapitiCore直接获取cookie
            async def get_cookie():
                # 创建临时cookie文件
                with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp:
                    cookie_file = temp.name
                
                try:
                    # 解析URL
                    from urllib.parse import urlparse
                    parts = urlparse(tool_request.target_url)
                    if not parts.scheme or not parts.netloc:
                        raise HTTPException(status_code=400, detail="Invalid URL")
                    
                    server = parts.netloc
                    
                    # 设置CrawlerConfiguration
                    base_request = Request(tool_request.target_url)
                    crawler_configuration = CrawlerConfiguration(base_request)
                    
                    # 加载或创建cookie文件
                    json_cookie = jsoncookie.JsonCookie()
                    json_cookie.load(cookie_file)
                    json_cookie.delete(server)
                    
                    # 获取登录页面并保存cookie
                    page_source = await async_fetch_login_page(crawler_configuration, tool_request.target_url, "no")
                    json_cookie.addcookies(crawler_configuration.cookies)
                    
                    # 保存cookie到文件
                    json_cookie.dump()
                    
                    # 读取cookie文件内容
                    with open(cookie_file, 'r') as f:
                        cookie_content = f.read()
                    
                    return cookie_content
                finally:
                    # 删除临时文件
                    if os.path.exists(cookie_file):
                        os.unlink(cookie_file)
            
            # 运行异步函数
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            cookie_result = loop.run_until_complete(get_cookie())
            
            return {
                "tool_name": tool_request.tool_name,
                "result": cookie_result
            }
        
        elif tool_request.tool_name == "wapiti_scan":
            # 使用wapitiCore直接运行扫描
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
                report_gen = jsonreportgenerator.JSONReportGenerator()
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

                # 生成HTML报告
                html_report_gen = HTMLReportGenerator()
                html_report_gen.set_report_info(
                    target=tool_request.target_url,
                    scope="folder",
                    date=wapiti.persister.start_time if hasattr(wapiti.persister, 'start_time') else None,
                    version=f"Wapiti {wapitiCore.WAPITI_VERSION}",
                    auth=None,
                    crawled_pages=[],
                    crawled_pages_nbr=await wapiti.count_resources(),
                    detailed_report_level=0
                )

                async for vulnerability in wapiti.persister.get_vulnerabilities():
                    html_report_gen.add_vulnerability(
                        category=vulnerability.category,
                        level=vulnerability.level,
                        request=vulnerability.request,
                        parameter=vulnerability.parameter,
                        info=vulnerability.info,
                        module=vulnerability.module,
                        wstg=vulnerability.wstg,
                        response=vulnerability.response
                    )

                # 创建报告保存目录
                report_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "reports")
                os.makedirs(report_dir, exist_ok=True)

                # 生成唯一的报告文件名
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                report_filename = f"report_{timestamp}.html"
                report_path = os.path.join(report_dir, report_filename)

                # 生成HTML报告文件
                html_report_gen.generate_report(report_path)

                # 生成JSON报告内容
                import io
                buffer = io.StringIO()
                report_gen.generate_report(buffer)
                buffer.seek(0)
                scan_result = buffer.read()

                # 返回JSON结果和HTML报告文件名
                return {
                    "tool_name": tool_request.tool_name,
                    "result": scan_result,
                    "html_report_filename": report_filename
                }
                
                # 生成报告内容
                import io
                buffer = io.StringIO()
                report_gen.generate_report(buffer)
                buffer.seek(0)
                scan_result = buffer.read()
                
                return scan_result
            
            # 运行异步函数
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            scan_result = loop.run_until_complete(run_scan())
            
            return {
                "tool_name": tool_request.tool_name,
                "result": scan_result
            }
        
        else:
            raise HTTPException(status_code=400, detail="Tool not supported")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoints for frontend tools
@router.post("/url-check/")
async def check_url_endpoint(request: UrlCheckRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import re
        from urllib.parse import urlparse
        
        # 验证URL格式
        url_pattern = re.compile(r'^(https?://)?([\da-z\.-]+)\.([a-z\.]{2,6})([/\w \.-]*)*/?$')
        is_valid = bool(url_pattern.match(request.url))
        
        # 解析URL
        parsed_url = urlparse(request.url)
        has_scheme = bool(parsed_url.scheme)
        has_domain = bool(parsed_url.netloc)
        
        # 解析端口
        port = parsed_url.port
        if not port:
            port = 80 if parsed_url.scheme == "http" else 443 if parsed_url.scheme == "https" else None
        
        result = {
            "is_valid": is_valid,
            "protocol": parsed_url.scheme,
            "domain": parsed_url.netloc,
            "port": port,
            "path": parsed_url.path
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ip-validate/")
async def validate_ip_endpoint(request: IpValidateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import ipaddress
        
        # 验证IP地址
        try:
            ip_obj = ipaddress.ip_address(request.ip)
            is_valid = True
            ip_type = "IPv4" if ip_obj.version == 4 else "IPv6"
            is_private = ip_obj.is_private
            is_loopback = ip_obj.is_loopback
        except ValueError:
            is_valid = False
            ip_type = "Invalid"
            is_private = False
            is_loopback = False
        
        result = {
            "is_valid": is_valid,
            "type": ip_type,
            "country": "Unknown",  # 简化实现，返回Unknown
            "city": "Unknown"  # 简化实现，返回Unknown
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-password/")
async def generate_password_endpoint(request: GeneratePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import secrets
        import string
        
        # 定义字符集
        characters = string.ascii_letters
        if request.options.get("numbers", True):
            characters += string.digits
        if request.options.get("special", True):
            characters += string.punctuation
        
        # 生成密码
        password = ''.join(secrets.choice(characters) for _ in range(request.length))
        
        # 计算密码强度
        strength = "weak"
        if len(password) >= 12:
            strength = "medium"
        if len(password) >= 16:
            strength = "strong"
        
        result = {
            "password": password,
            "strength": strength
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/base64-encode/")
async def encode_base64_endpoint(request: Base64Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import base64
        
        # 编码为Base64
        encoded_bytes = base64.b64encode(request.text.encode('utf-8'))
        encoded_string = encoded_bytes.decode('utf-8')
        
        result = {
            "result": encoded_string
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/base64-decode/")
async def decode_base64_endpoint(request: Base64Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import base64
        
        # 从Base64解码
        decoded_bytes = base64.b64decode(request.text.encode('utf-8'))
        decoded_string = decoded_bytes.decode('utf-8')
        
        result = {
            "result": decoded_string
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 新增多种编码转换功能
class EncodingRequest(BaseModel):
    text: str
    action: str  # encode or decode
    encoding_type: str  # base64, url, hex, ascii, binary

@router.post("/encoding-converter/")
async def encoding_converter_endpoint(request: EncodingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import base64
        import urllib.parse
        import html
        
        text = request.text
        action = request.action
        encoding_type = request.encoding_type.lower()
        
        result = {"original_text": text, "encoding_type": encoding_type, "action": action}
        
        if encoding_type == "base64":
            if action == "encode":
                encoded_bytes = base64.b64encode(text.encode('utf-8'))
                result["result"] = encoded_bytes.decode('utf-8')
            elif action == "decode":
                decoded_bytes = base64.b64decode(text.encode('utf-8'))
                result["result"] = decoded_bytes.decode('utf-8')
        
        elif encoding_type == "url":
            if action == "encode":
                result["result"] = urllib.parse.quote(text)
            elif action == "decode":
                result["result"] = urllib.parse.unquote(text)
        
        elif encoding_type == "hex":
            if action == "encode":
                result["result"] = text.encode('utf-8').hex()
            elif action == "decode":
                result["result"] = bytes.fromhex(text).decode('utf-8')
        
        elif encoding_type == "ascii":
            if action == "encode":
                result["result"] = ' '.join([str(ord(c)) for c in text])
            elif action == "decode":
                ascii_values = [int(x) for x in text.split()]
                result["result"] = ''.join([chr(c) for c in ascii_values])
        
        elif encoding_type == "binary":
            if action == "encode":
                result["result"] = ' '.join([format(ord(c), '08b') for c in text])
            elif action == "decode":
                binary_values = text.split()
                result["result"] = ''.join([chr(int(b, 2)) for b in binary_values])
        
        elif encoding_type == "html":
            if action == "encode":
                result["result"] = html.escape(text)
            elif action == "decode":
                result["result"] = html.unescape(text)
        
        elif encoding_type == "base32":
            if action == "encode":
                import base64
                encoded_bytes = base64.b32encode(text.encode('utf-8'))
                result["result"] = encoded_bytes.decode('utf-8')
            elif action == "decode":
                import base64
                decoded_bytes = base64.b32decode(text.encode('utf-8'))
                result["result"] = decoded_bytes.decode('utf-8')
        
        elif encoding_type == "base16":
            if action == "encode":
                import base64
                encoded_bytes = base64.b16encode(text.encode('utf-8'))
                result["result"] = encoded_bytes.decode('utf-8')
            elif action == "decode":
                import base64
                decoded_bytes = base64.b16decode(text.encode('utf-8'))
                result["result"] = decoded_bytes.decode('utf-8')
        
        elif encoding_type == "rot13":
            if action == "encode" or action == "decode":  # ROT13是可逆的
                result["result"] = text.encode('utf-8').decode('utf-8').translate(
                    str.maketrans(
                        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                        'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm'
                    )
                )
        
        elif encoding_type == "reverse":
            if action == "encode" or action == "decode":  # 反转字符串是可逆的
                result["result"] = text[::-1]
        
        else:
            raise HTTPException(status_code=400, detail=f"不支持的编码类型: {encoding_type}")
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"编码转换失败: {str(e)}")

# 新增端口扫描功能
class PortScanRequest(BaseModel):
    target: str
    ports: str = "1-1000"  # 默认扫描常见端口
    timeout: int = 1  # 默认超时时间1秒

@router.post("/port-scan/")
async def port_scan_endpoint(request: PortScanRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import socket
        import threading
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        # 解析目标
        target = request.target.strip()
        
        # 解析端口范围
        ports = []
        if '-' in request.ports:
            start, end = request.ports.split('-')
            ports = list(range(int(start), int(end) + 1))
        elif ',' in request.ports:
            ports = [int(port.strip()) for port in request.ports.split(',')]
        else:
            ports = [int(request.ports)]
        
        # 限制端口范围以避免过度扫描
        if len(ports) > 10000:
            raise HTTPException(status_code=400, detail="端口范围过大，请限制在10000个端口以内")
        
        # 扫描结果
        open_ports = []
        
        def scan_port(port):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(request.timeout)
                result = sock.connect_ex((target, port))
                sock.close()
                
                if result == 0:
                    return port
                return None
            except Exception:
                return None
        
        # 使用线程池进行端口扫描
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_port = {executor.submit(scan_port, port): port for port in ports}
            
            for future in as_completed(future_to_port):
                result = future.result()
                if result is not None:
                    open_ports.append(result)
        
        # 按端口号排序
        open_ports.sort()
        
        # 获取常见端口的服务信息
        common_services = {
            21: "FTP",
            22: "SSH",
            23: "Telnet",
            25: "SMTP",
            53: "DNS",
            80: "HTTP",
            110: "POP3",
            143: "IMAP",
            443: "HTTPS",
            445: "SMB",
            993: "IMAPS",
            995: "POP3S",
            1433: "MSSQL",
            1521: "Oracle",
            3306: "MySQL",
            3389: "RDP",
            5432: "PostgreSQL",
            6379: "Redis",
            9200: "Elasticsearch",
            27017: "MongoDB"
        }
        
        # 添加服务信息
        result = []
        for port in open_ports:
            service = common_services.get(port, "Unknown")
            result.append({
                "port": port,
                "service": service,
                "status": "open"
            })
        
        return {
            "target": target,
            "open_ports": result,
            "total_open": len(result)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"端口扫描失败: {str(e)}")

# 新增资产分拣功能
class AssetSortingRequest(BaseModel):
    text: str

@router.post("/asset-sorting/")
async def asset_sorting_endpoint(request: AssetSortingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        import re
        import ipaddress
        from urllib.parse import urlparse
        
        text = request.text
        
        # 初始化结果
        result = {
            "internal_ips": [],
            "external_ips": [],
            "main_domains": [],
            "sub_domains": [],
            "c_segments": [],
            "urls": []
        }
        
        # 分割文本为行
        lines = text.strip().split('\n')
        
        # IP正则表达式
        ip_pattern = r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b'
        # 域名正则表达式
        domain_pattern = r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b'
        # URL正则表达式
        url_pattern = r'https?://[^\s\'"<>]+'
        
        # 提取所有可能的IP
        all_ips = []
        for line in lines:
            found_ips = re.findall(ip_pattern, line)
            all_ips.extend(found_ips)
        
        # 分类IP
        internal_networks = [
            ipaddress.IPv4Network('10.0.0.0/8'),
            ipaddress.IPv4Network('172.16.0.0/12'),
            ipaddress.IPv4Network('192.168.0.0/16'),
            ipaddress.IPv4Network('127.0.0.0/8'),
            ipaddress.IPv4Network('169.254.0.0/16')
        ]
        
        for ip_str in all_ips:
            try:
                ip_obj = ipaddress.IPv4Address(ip_str)
                is_internal = any(ip_obj in net for net in internal_networks)
                
                if is_internal:
                    if ip_str not in result["internal_ips"]:
                        result["internal_ips"].append(ip_str)
                else:
                    if ip_str not in result["external_ips"]:
                        result["external_ips"].append(ip_str)
            except:
                continue
        
        # 提取所有可能的域名
        all_domains = []
        for line in lines:
            found_domains = re.findall(domain_pattern, line)
            all_domains.extend(found_domains)
        
        # 分类域名
        for domain in all_domains:
            # 检查是否为URL的一部分
            is_url_part = any(domain in line and re.search(url_pattern, line) for line in lines)
            if is_url_part:
                continue  # 如果是URL的一部分，则跳过域名提取
            
            # 简单判断是否为子域名（包含多个点，且不是常见的顶级域名）
            parts = domain.split('.')
            if len(parts) > 2:
                if domain not in result["sub_domains"]:
                    result["sub_domains"].append(domain)
            else:
                if domain not in result["main_domains"]:
                    result["main_domains"].append(domain)
        
        # 提取URL
        all_urls = []
        for line in lines:
            found_urls = re.findall(url_pattern, line)
            all_urls.extend(found_urls)
        
        for url in all_urls:
            if url not in result["urls"]:
                result["urls"].append(url)
        
        # 从URL中提取域名和IP
        for url in result["urls"]:
            try:
                parsed = urlparse(url)
                netloc = parsed.netloc
                
                # 如果netloc包含端口，需要提取主机部分
                if ':' in netloc:
                    host = netloc.split(':')[0]
                else:
                    host = netloc
                
                # 检查是否为IP
                try:
                    ipaddress.IPv4Address(host)
                    is_internal = any(ipaddress.IPv4Address(host) in net for net in internal_networks)
                    if is_internal and host not in result["internal_ips"]:
                        result["internal_ips"].append(host)
                    elif not is_internal and host not in result["external_ips"]:
                        result["external_ips"].append(host)
                except ValueError:
                    # 不是IP，是域名
                    parts = host.split('.')
                    if len(parts) > 2:
                        if host not in result["sub_domains"]:
                            result["sub_domains"].append(host)
                    else:
                        if host not in result["main_domains"]:
                            result["main_domains"].append(host)
            except:
                continue
        
        # 生成C段网络
        c_segments = set()
        
        # 处理外网IP
        for ip in result["external_ips"]:
            try:
                ip_obj = ipaddress.IPv4Address(ip)
                c_segment = f"{ip_obj}.0/24".replace(f"{ip_obj}", f"{ip_obj.network_element(0)}.{ip_obj.network_element(1)}.{ip_obj.network_element(2)}")
                # 更正C段计算
                octets = str(ip_obj).split('.')
                c_segment = f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"
                c_segments.add(c_segment)
            except:
                continue
        
        # 处理内网IP
        for ip in result["internal_ips"]:
            try:
                ip_obj = ipaddress.IPv4Address(ip)
                octets = str(ip_obj).split('.')
                c_segment = f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"
                c_segments.add(c_segment)
            except:
                continue
        
        result["c_segments"] = sorted(list(c_segments))
        
        # 去重并排序结果
        result["internal_ips"] = sorted(list(set(result["internal_ips"])))
        result["external_ips"] = sorted(list(set(result["external_ips"])))
        result["main_domains"] = sorted(list(set(result["main_domains"])))
        result["sub_domains"] = sorted(list(set(result["sub_domains"])))
        result["urls"] = sorted(list(set(result["urls"])))
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"资产分拣失败: {str(e)}")

@router.get("/download-report/{report_filename}")
async def download_report(report_filename: str, current_user: User = Depends(get_current_user)):
    # 构建报告文件路径
    report_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "reports")
    file_path = os.path.join(report_dir, report_filename)

    # 检查文件是否存在
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="报告文件不存在")

    # 返回文件下载响应
    return FileResponse(
        file_path,
        filename=report_filename,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={report_filename}"}
    )