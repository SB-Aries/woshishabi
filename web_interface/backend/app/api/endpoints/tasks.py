from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime
import subprocess
import json
import os
import signal
import threading
import logging
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent.parent
logs_dir = project_root / 'logs'
logs_dir.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(logs_dir / 'tasks.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Global dictionary to track running tasks and their processes
running_tasks: Dict[int, dict] = {}
# Lock for thread safety
running_tasks_lock = threading.Lock()

from ...database import get_db
from ...models.task import Task
from ...models.project import Project
from ...models.user import User
from ..endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"]
)

# Pydantic models
class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    scan_type: str  # full, quick, custom
    status: Optional[str] = "pending"
    target_url: str
    is_recurring: Optional[bool] = False
    cron_expression: Optional[str] = None

class TaskCreate(TaskBase):
    project_id: int

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    scan_type: Optional[str] = None
    status: Optional[str] = None
    target_url: Optional[str] = None
    is_recurring: Optional[bool] = None
    cron_expression: Optional[str] = None

class TaskResponse(TaskBase):
    id: int
    project_id: int
    created_by: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    scan_result: Optional[str] = None
    progress: int = 0
    next_run: Optional[datetime] = None

    class Config:
        from_attributes = True

# Helper function to run Wapiti scan
import asyncio
import os
import sys
import signal
import threading
import logging
from pathlib import Path

# 计算项目根目录并定义日志目录
project_root = Path(__file__).parent.parent.parent.parent.parent.parent
logs_dir = project_root / 'logs'
logs_dir.mkdir(exist_ok=True)

# Apply monkey patch to signal module EARLY before importing any wapiti modules
# This is crucial because wapiti modules might cache the original signal.signal function
import sys

# Save original signal function
original_signal = signal.signal

def patched_signal(signalnum, handler):
    """Patched signal handler that only works in main thread"""
    if threading.current_thread().ident == threading.main_thread().ident:
        return original_signal(signalnum, handler)
    logger.debug(f"Ignoring signal {signalnum} registration in non-main thread")
    return handler

# Apply the patch globally
if not hasattr(signal, '_original_signal'):
    # Patch the signal module in sys.modules
    signal._original_signal = original_signal
    signal.signal = patched_signal
    
    # Also ensure any future imports get the patched version
    if 'signal' in sys.modules:
        sys.modules['signal'].signal = patched_signal
    
    logger.info("Applied signal handler monkey patch at module level globally")

# Import wapitiCore modules directly since it's a standard Python package
import wapitiCore
from wapitiCore.controller.wapiti import Wapiti
from wapitiCore.net import Request
from wapitiCore.attack.modules.core import resolve_module_settings
from wapitiCore.main.log import configure as configure_logging
from wapitiCore.report import jsonreportgenerator
from wapitiCore.report import htmlreportgenerator

def run_wapiti_scan(task_id: int, db: Session):
    logger.info(f"Starting Wapiti scan for task {task_id}")
    
    # Get task from database
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        logger.error(f"Task {task_id} not found in database")
        return
    
    # Get project
    project = db.query(Project).filter(Project.id == task.project_id).first()
    if not project:
        logger.error(f"Project for task {task_id} not found in database")
        return
    
    # Update task status to running
    task.status = "running"
    task.started_at = datetime.now()
    task.progress = 0
    db.commit()
    logger.info(f"Updated task {task_id} status to 'running'")
    
    # Register the task in the running tasks dictionary
    with running_tasks_lock:
        running_tasks[task_id] = {
            'stop_event': None,
            'thread_id': threading.get_ident()
        }
    
    try:
        # Configure logging
        log_file = logs_dir / f"task_{task_id}.log"
        configure_logging([{
            "sink": sys.stdout,
            "colorize": False,
            "level": "VERBOSE"
        }, {
            "sink": log_file,
            "colorize": False,
            "level": "DEBUG"
        }])
        logger.info(f"Configured Wapiti logging for task {task_id}")
        
        # Create a base request for the target URL
        base_request = Request(task.target_url)
        logger.info(f"Created base request for URL: {task.target_url}")
        
        # Create a Wapiti instance
        wapiti = Wapiti(
            base_request, 
            scope="folder",
            session_dir=None,  # Use temporary directory
            config_dir=None     # Use default config directory
        )
        logger.info(f"Created Wapiti instance for task {task_id}")
        
        # Set scan parameters based on scan type
        if task.scan_type == "full":
            modules = "all"
        elif task.scan_type == "quick":
            modules = "sql,xss,redirect"
        else:  # custom
            modules = "sql,xss,exec,file,htaccess,backup"
        logger.info(f"Set scan modules '{modules}' for task {task_id} based on scan type '{task.scan_type}'")
        
        # Resolve and set modules
        activated_modules = resolve_module_settings(modules)
        # Set attack options with default tasks parameter - this fixes the KeyError: 'tasks'
        wapiti.active_scanner.attack_options = {"tasks": 32}
        wapiti.active_scanner.set_modules(activated_modules)
        wapiti.passive_scaner.set_modules(activated_modules)
        logger.info(f"Activated {len(activated_modules)} scan modules for task {task_id}")
        
        # Set basic scan options
        wapiti.set_timeout(15.0)  # Increase timeout to handle slow responses that might lead to 502 errors
        wapiti.set_verify_ssl(False)  # Don't verify SSL for now
        logger.info(f"Set scan options for task {task_id}: timeout=15.0s, verify_ssl=False")
        
        # Define the async scan function
        async def run_scan():
            # Initialize persister
            await wapiti.init_persister()
            logger.info(f"Initialized persister for task {task_id}")
            
            # Load scan state (if any)
            await wapiti.load_scan_state()
            logger.info(f"Loaded scan state for task {task_id}")
            
            # Create a stop event
            stop_event = asyncio.Event()
            
            # Update the stop event in the running tasks dictionary
            with running_tasks_lock:
                if task_id in running_tasks:
                    running_tasks[task_id]['stop_event'] = stop_event
            logger.info(f"Created stop event for task {task_id}")
            
            # Browse the website with progress updates
            logger.info(f"Starting browsing phase for task {task_id}")
            await wapiti.browse(stop_event)
            logger.info(f"Completed browsing phase for task {task_id}")
            
            # Update progress to 50% after browsing
            task.progress = 50
            db.commit()
            logger.info(f"Updated task {task_id} progress to 50%")
            
            # Run the attacks
            logger.info(f"Starting attack phase for task {task_id}")
            
            scan_result = None
            try:
                # Fix signal handler issue in non-main thread
                import signal
                original_signal = signal.getsignal(signal.SIGINT)
                
                # Execute the attack phase
                await wapiti.active_scanner.attack()
                
                # Restore original signal handler
                signal.signal(signal.SIGINT, original_signal)
                
                # Update progress to 75% after attacks
                task.progress = 75
                db.commit()
                logger.info(f"Updated task {task_id} progress to 75%")
                
                # Generate report regardless of whether vulnerabilities were found
                logger.info(f"Starting report generation for task {task_id}")
                # Fixed class name - JsonReportGenerator should be JSONReportGenerator
                report_gen = jsonreportgenerator.JSONReportGenerator()
                import time
                # Get the start time from persister or use current time if not available
                start_time = wapiti.persister.start_time if hasattr(wapiti.persister, 'start_time') else time.localtime()
                report_gen.set_report_info(
                    target=task.target_url,
                    scope="folder",
                    date=start_time,
                    version=f"Wapiti {wapitiCore.WAPITI_VERSION}",
                    auth=None,
                    crawled_pages=[],
                    crawled_pages_nbr=await wapiti.count_resources(),
                    detailed_report_level=0
                )
                
                # Get payloads (vulnerabilities and anomalies)
                vuln_count = 0
                anomaly_count = 0
                additional_count = 0
                
                try:
                    # Create a list to store payloads
                    payloads = []
                    async for payload in wapiti.persister.get_payloads():
                        payloads.append(payload)
                    
                    # Process payloads
                    for payload in payloads:
                        # Payload is a namedtuple: evil_request,category,level,parameter,info,type,wstg,module,response
                        
                        # Add as vulnerability
                        try:
                            # Safely extract payload attributes with defaults to prevent IndexError
                            module = getattr(payload, 'module', '')
                            category = getattr(payload, 'category', '')
                            level = getattr(payload, 'level', 0)
                            evil_request = getattr(payload, 'evil_request', None)
                            parameter = getattr(payload, 'parameter', '')
                            info = getattr(payload, 'info', '')
                            wstg = getattr(payload, 'wstg', None)
                            response = getattr(payload, 'response', None)
                            
                            if evil_request is not None:
                                report_gen.add_vulnerability(
                                    module=module,
                                    category=category,
                                    level=level,
                                    request=evil_request,
                                    parameter=parameter,
                                    info=info,
                                    wstg=wstg,
                                    response=response
                                )
                                vuln_count += 1
                            else:
                                logger.warning(f"Skipping payload for task {task_id} due to missing request")
                        except Exception as e:
                            if "list index out of range" in str(e) and "http_repr" in str(e.__traceback__):
                                logger.warning(f"Skipping invalid URL vulnerability for task {task_id}: {str(e)}")
                            elif "signal only works in main thread" in str(e):
                                logger.warning(f"Skipping signal handler setup in non-main thread for task {task_id}")
                            else:
                                logger.error(f"Error adding vulnerability for task {task_id}: {str(e)}", exc_info=True)
                except Exception as e:
                    logger.error(f"Error while fetching payloads for task {task_id}: {str(e)}", exc_info=True)
                
                logger.info(f"Found {vuln_count} vulnerabilities for task {task_id}")
                logger.info(f"Found {anomaly_count} anomalies for task {task_id}")
                logger.info(f"Found {additional_count} additional items for task {task_id}")
                
                # Generate report content
                import tempfile
                import json
                import os
                
                # Create a temporary file for JSON report
                with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.json') as temp_file:
                    temp_file_path = temp_file.name
                
                # Generate JSON report to temporary file
                report_gen.generate_report(temp_file_path)
                
                # Read the JSON content from temporary file
                with open(temp_file_path, 'r', encoding='utf-8') as f:
                    scan_result = f.read()
                
                # Clean up temporary JSON file
                os.unlink(temp_file_path)
                logger.info(f"Generated JSON report for task {task_id}")
                
                # Generate HTML report
                logger.info(f"Generating HTML report for task {task_id}")
                
                # Create reports directory if it doesn't exist
                from pathlib import Path
                reports_dir = Path(__file__).parent.parent.parent.parent.parent / "reports"
                reports_dir = str(reports_dir)
                os.makedirs(reports_dir, exist_ok=True)
                
                # Generate HTML report file path
                html_report_path = os.path.join(reports_dir, f"task_{task_id}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
                
                # Create HTML report generator and use the same report info
                html_report_gen = htmlreportgenerator.HTMLReportGenerator()
                html_report_gen.set_report_info(
                    target=task.target_url,
                    scope="folder",
                    date=start_time,
                    version=f"Wapiti {wapitiCore.WAPITI_VERSION}",
                    auth=None,
                    crawled_pages=[],
                    crawled_pages_nbr=await wapiti.count_resources(),
                    detailed_report_level=0
                )
                
                # Re-add all vulnerabilities to HTML report generator
                # First parse the JSON to get vulnerabilities
                try:
                    scan_result_json = json.loads(scan_result)
                    if "vulnerabilities" in scan_result_json:
                        for category_name, vulnerabilities_list in scan_result_json["vulnerabilities"].items():
                            # Skip if vulnerabilities_list is not a list
                            if not isinstance(vulnerabilities_list, list):
                                logger.warning(f"Skipping vulnerabilities category '{category_name}' as it is not a list: {type(vulnerabilities_list)}")
                                continue
                                
                            for vuln_item in vulnerabilities_list:
                                # Add vulnerability to HTML report generator
                                try:
                                    # Handle case where vuln_item might be a string instead of dict
                                    if isinstance(vuln_item, str):
                                        logger.warning(f"Skipping vulnerability item which is a string: {vuln_item}")
                                        continue
                                        
                                    # Safely extract vulnerability attributes with defaults
                                    module = vuln_item.get("module") if vuln_item.get("module") is not None else "unknown"
                                    category = category_name  # Use the category name from the outer loop
                                    level = vuln_item.get("level") if vuln_item.get("level") is not None else 0
                                    request = vuln_item.get("request")
                                    parameter = vuln_item.get("parameter") if vuln_item.get("parameter") is not None else ""
                                    info = vuln_item.get("info") if vuln_item.get("info") is not None else ""
                                    wstg = vuln_item.get("wstg")
                                    response = vuln_item.get("response")
                                    
                                    # Skip if request is None
                                    if request is None:
                                        logger.warning(f"Skipping vulnerability in category '{category}' as request is None")
                                        continue
                                    
                                    html_report_gen.add_vulnerability(
                                        module=module,
                                        category=category,
                                        level=level,
                                        request=request,
                                        parameter=parameter,
                                        info=info,
                                        wstg=wstg,
                                        response=response
                                    )
                                except Exception as e:
                                    logger.error(f"Error adding vulnerability to HTML report for task {task_id}: {str(e)}", exc_info=True)
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding JSON scan result for task {task_id}: {str(e)}")
                
                # Generate HTML report
                html_report_gen.generate_report(html_report_path)
                logger.info(f"Generated HTML report for task {task_id} at {html_report_gen.final_path}")
                
                # Return both scan result and HTML report path
                return (scan_result, html_report_path)
            except Exception as e:
                if "signal only works in main thread" in str(e):
                    logger.warning(f"Signal handler issue in non-main thread for task {task_id}, continuing...")
                    # Continue with report generation even if signal setup failed
                    task.progress = 75
                    db.commit()
                    logger.info(f"Updated task {task_id} progress to 75%")
                else:
                    logger.error(f"Error during attack phase for task {task_id}: {str(e)}")
                    logger.exception("Full traceback:")
                    return (None, None)
            
        # Run the async scan
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        logger.info(f"Created new event loop for task {task_id}")
        scan_result, html_report_path = loop.run_until_complete(run_scan())
        
        # Update task with results
        if scan_result is not None:
            task.status = "completed"
            task.scan_result = scan_result
            task.completed_at = datetime.now()
            task.progress = 100
            logger.info(f"Task {task_id} completed successfully")
            
            # Create report entry in reports table
            from ...models.report import Report
            db_report = Report(
                task_id=task.id,
                project_id=task.project_id,
                scan_type=task.scan_type,
                status="completed",
                scan_result=scan_result,
                report_file_path=html_report_path,
                created_by=task.created_by
            )
            db.add(db_report)
            logger.info(f"Created report entry for task {task_id} with HTML report at {html_report_path}")
        else:
            task.status = "failed"
            task.scan_result = "No report generated due to attack phase failure"
            task.completed_at = datetime.now()
            # Keep current progress to show how far the task got
            logger.error(f"Task {task_id} failed: No report generated due to attack phase failure")
        
        # Commit task changes immediately to ensure status and report are saved
        db.commit()
        logger.info(f"Committed task {task_id} changes to database")
        
        # Update project status if needed
        if project.status != "completed":
            project.status = "completed"
            project.ended_at = datetime.now()
            db.commit()
            db.refresh(project)
            logger.info(f"Updated project {project.id} status to 'completed' for task {task_id}")
            
    except Exception as e:
        # Update task status to failed
        task.status = "failed"
        task.scan_result = str(e)
        task.completed_at = datetime.now()
        # Keep current progress to show how far the task got
        logger.error(f"Task {task_id} failed with error: {str(e)}", exc_info=True)
    finally:
        # Restore original signal function in all cases
        import signal
        # Use the module-level original_signal directly
        global original_signal
        if hasattr(signal, '_original_signal'):
            signal.signal = original_signal
            logger.info("Restored original signal handler")
    
    # Remove the task from the running tasks dictionary
    with running_tasks_lock:
        if task_id in running_tasks:
            del running_tasks[task_id]
            logger.info(f"Removed task {task_id} from running tasks dictionary")
    
    # Commit changes
    db.commit()
    logger.info(f"Committed final changes for task {task_id}")

# Routes
@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if project exists
    project = db.query(Project).filter(Project.id == task.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create new task
    db_task = Task(
        **task.model_dump(),
        created_by=current_user.id
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by task status"),
    scan_type: Optional[str] = Query(None, description="Filter by scan type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Build query
    query = db.query(Task)
    
    # Apply filters
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status)
    if scan_type:
        query = query.filter(Task.scan_type == scan_type)
    
    # Execute query with pagination
    tasks = query.offset(skip).limit(limit).all()
    return tasks

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is the creator
    if task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
    
    # Update task fields
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    db.commit()
    db.refresh(task)
    return task

@router.get("/{task_id}/progress")
def get_task_progress(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is the creator
    if task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this task")
    
    return {
        "id": task.id,
        "status": task.status,
        "progress": task.progress,
        "started_at": task.started_at,
        "completed_at": task.completed_at
    }

@router.post("/{task_id}/stop", response_model=TaskResponse)
def stop_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is the creator
    if task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to stop this task")
    
    # Check if task is already stopped or completed
    if task.status in ["stopped", "completed", "failed"]:
        raise HTTPException(status_code=400, detail="Task is already stopped, completed, or failed")
    
    # Stop the running task if it's in progress
    with running_tasks_lock:
        if task_id in running_tasks:
            task_info = running_tasks[task_id]
            stop_event = task_info.get('stop_event')
            
            # If we have a stop event, signal the task to stop
            if stop_event is not None:
                stop_event.set()
            
            # Remove the task from the running tasks dictionary
            del running_tasks[task_id]
    
    # Update task status to stopped
    task.status = "stopped"
    task.completed_at = datetime.now()
    task.progress = task.progress  # Keep current progress
    db.commit()
    db.refresh(task)
    
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is the creator
    if task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")
    
    # Stop the task if it's running
    if task.status == "running":
        with running_tasks_lock:
            if task_id in running_tasks:
                task_info = running_tasks[task_id]
                stop_event = task_info.get('stop_event')
                
                # If we have a stop event, signal the task to stop
                if stop_event is not None:
                    stop_event.set()
                
                # Remove the task from the running tasks dictionary
                del running_tasks[task_id]
    
    # Delete task
    db.delete(task)
    db.commit()
    return {}

@router.post("/{task_id}/run", response_model=TaskResponse)
def run_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is the creator
    if task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to run this task")
    
    # Check if task is already running or completed
    if task.status in ["running", "completed"]:
        raise HTTPException(status_code=400, detail="Task is already running or completed")
    
    # Add task to background
    background_tasks.add_task(run_wapiti_scan, task_id, db)
    
    # Refresh task from database to get updated status
    db.refresh(task)
    return task


