from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime

class Vulnerability(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    severity: str
    location: str
    details: Optional[str] = None

class RemediationSuggestion(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vulnerability_id: int
    suggestion: str
    code_example: Optional[str] = None

class ReportBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    scan_type: str
    status: str = "completed"
    vulnerabilities: Optional[List[Vulnerability]] = None
    remediation_suggestions: Optional[List[RemediationSuggestion]] = None

class ReportCreate(ReportBase):
    task_id: int

class ReportUpdate(BaseModel):
    status: Optional[str] = None
    vulnerabilities: Optional[List[Vulnerability]] = None
    remediation_suggestions: Optional[List[RemediationSuggestion]] = None

class Report(ReportBase):
    id: int
    task_id: int
    project_id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None
