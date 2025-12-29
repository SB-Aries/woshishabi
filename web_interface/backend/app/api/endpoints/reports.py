from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import os
import tempfile

from ...database import get_db
from ...models.report import Report
from ...models.task import Task
from ...models.user import User
from ..endpoints.auth import get_current_user
from pydantic import BaseModel
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter(
    prefix="/reports",
    tags=["reports"]
)

# Pydantic models
class VulnerabilityItem(BaseModel):
    type: str
    severity: str
    location: str
    description: str
    details: Optional[dict] = None

class RemediationItem(BaseModel):
    vulnerability_type: str
    suggestion: str
    code_example: Optional[str] = None

class ReportCreate(BaseModel):
    task_id: int
    project_id: int
    scan_type: str
    status: str
    scan_result: Optional[str] = None
    vulnerabilities: Optional[List[VulnerabilityItem]] = None
    remediation_suggestions: Optional[List[RemediationItem]] = None
    created_by: int

class ReportResponse(BaseModel):
    id: int
    task_id: int
    project_id: int
    scan_type: str
    status: str
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    scan_result: Optional[str] = None
    vulnerabilities: Optional[List[VulnerabilityItem]] = None
    remediation_suggestions: Optional[List[RemediationItem]] = None
    report_file_path: Optional[str] = None

    class Config:
        from_attributes = True

# Routes
@router.get("/", response_model=List[ReportResponse])
def get_reports(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    task_id: Optional[int] = Query(None, description="Filter by task ID"),
    scan_type: Optional[str] = Query(None, description="Filter by scan type"),
    status: Optional[str] = Query(None, description="Filter by task status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Build query
    query = db.query(Report)
    
    # Apply filters
    if project_id:
        query = query.filter(Report.project_id == project_id)
    if task_id:
        query = query.filter(Report.task_id == task_id)
    if scan_type:
        query = query.filter(Report.scan_type == scan_type)
    if status:
        query = query.filter(Report.status == status)
    
    # Execute query with pagination
    reports = query.offset(skip).limit(limit).all()
    return reports

@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get report by ID
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@router.post("/", response_model=ReportResponse)
def create_report(
    report: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Create new report
    db_report = Report(
        task_id=report.task_id,
        project_id=report.project_id,
        scan_type=report.scan_type,
        status=report.status,
        scan_result=report.scan_result,
        vulnerabilities=report.vulnerabilities,
        remediation_suggestions=report.remediation_suggestions,
        created_by=report.created_by
    )
    
    # Add to database
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    return db_report

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get report by ID
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Delete report
    db.delete(report)
    db.commit()
    
    return None

@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get report by ID
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check if report file exists
    if not report.report_file_path or not os.path.exists(report.report_file_path):
        # If report file doesn't exist, generate it dynamically from scan result
        if not report.scan_result:
            raise HTTPException(status_code=404, detail="No scan result available to generate report")
        
        try:
            # Import Wapiti report generators
            from wapitiCore.report.htmlreportgenerator import HTMLReportGenerator
            from wapitiCore.report.jsonreportgenerator import JSONReportGenerator
            
            # Create a temporary directory for report generation
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create HTML report generator
                html_report_gen = HTMLReportGenerator()
                
                # Parse scan result
                try:
                    scan_result = json.loads(report.scan_result)
                except json.JSONDecodeError:
                    # If scan result is not valid JSON, create a basic structure
                    scan_result = {
                        "classifications": {},
                        "vulnerabilities": {},
                        "anomalies": {},
                        "additionals": {},
                        "infos": {
                            "version": "Wapiti Web Interface",
                            "target": "Unknown",
                            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "scope": "Unknown",
                            "auth": None,
                            "crawled_pages_nbr": 0,
                            "detailed_report_level": 0
                        }
                    }
                
                # Set report info
                html_report_gen._infos = scan_result.get("infos", {})
                html_report_gen._vulns = scan_result.get("vulnerabilities", {})
                html_report_gen._anomalies = scan_result.get("anomalies", {})
                html_report_gen._additionals = scan_result.get("additionals", {})
                html_report_gen._flaw_types = scan_result.get("classifications", {})
                html_report_gen._date = datetime.now().timetuple()
                
                # Generate HTML report to temporary directory
                html_report_gen.generate_report(temp_dir)
                
                # Get project root directory dynamically
                project_root = Path(__file__).parent.parent.parent.parent.parent.parent
                reports_dir = project_root / 'reports'
                
                # Ensure reports directory exists
                os.makedirs(reports_dir, exist_ok=True)
                
                # Move generated report to reports directory
                generated_report_path = html_report_gen.final_path
                if generated_report_path and os.path.exists(generated_report_path):
                    report_filename = os.path.basename(generated_report_path)
                    final_report_path = os.path.join(reports_dir, report_filename)
                    
                    # Check if generated_report_path is a file or directory
                    if os.path.isfile(generated_report_path):
                        # Copy the generated report to the final location
                        import shutil
                        shutil.copy(generated_report_path, final_report_path)
                        final_report_path = os.path.join(reports_dir, report_filename)
                    elif os.path.isdir(generated_report_path):
                        # If it's a directory, we need to handle it differently
                        import shutil
                        # Actually, let's check what's inside this directory
                        dir_contents = os.listdir(generated_report_path)
                        html_files = [f for f in dir_contents if f.endswith('.html') and f != 'report.html']
                        if html_files:
                            # Prefer the specific target report file over the template
                            main_html_file = os.path.join(generated_report_path, html_files[0])
                            final_report_path = os.path.join(reports_dir, html_files[0])
                            shutil.copy(main_html_file, final_report_path)
                        else:
                            # Fallback to copying the whole directory
                            dest_dir = os.path.join(reports_dir, os.path.basename(generated_report_path))
                            if os.path.exists(dest_dir):
                                shutil.rmtree(dest_dir)
                            shutil.copytree(generated_report_path, dest_dir)
                            final_report_path = dest_dir
                    
                    # Update report record with new file path
                    report.report_file_path = final_report_path
                    db.commit()
                    
                    # Return file response
                    if os.path.isfile(final_report_path):
                        return FileResponse(final_report_path, filename=os.path.basename(final_report_path))
                    else:
                        # If it's a directory, we need to return the main HTML file inside it
                        dir_contents = os.listdir(final_report_path)
                        html_files = [f for f in dir_contents if f.endswith('.html') and f != 'report.html']
                        if html_files:
                            main_html_path = os.path.join(final_report_path, html_files[0])
                            return FileResponse(main_html_path, filename=html_files[0])
                        else:
                            raise HTTPException(status_code=500, detail="Could not find HTML report file")
                else:
                    raise HTTPException(status_code=500, detail="Generated report path does not exist")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    else:
        # Return existing file response
        return FileResponse(report.report_file_path, filename=os.path.basename(report.report_file_path))

@router.post("/task/{task_id}/generate")
def generate_report_from_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get task by ID
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if report already exists for this task
    existing_report = db.query(Report).filter(Report.task_id == task_id).first()
    if existing_report:
        raise HTTPException(status_code=400, detail="Report already exists for this task")
    
    # Parse scan result to extract vulnerabilities and remediation suggestions
    vulnerabilities = []
    remediation_suggestions = []
    
    if task.scan_result and isinstance(task.scan_result, (str, bytes, bytearray)):
        try:
            scan_result = json.loads(task.scan_result)
            
            # Extract vulnerabilities
            if "vulnerabilities" in scan_result:
                vulnerabilities = scan_result["vulnerabilities"]
            
            # Extract remediation suggestions
            if "remediation_suggestions" in scan_result:
                remediation_suggestions = scan_result["remediation_suggestions"]
        except json.JSONDecodeError:
            # If scan result is not valid JSON, use it as is
            pass
    
    # Create new report
    db_report = Report(
        task_id=task.id,
        project_id=task.project_id,
        scan_type=task.scan_type,
        status=task.status,
        scan_result=task.scan_result,
        vulnerabilities=vulnerabilities,
        remediation_suggestions=remediation_suggestions,
        created_by=task.created_by
    )
    
    # Add to database
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    return db_report
