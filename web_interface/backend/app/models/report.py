from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    scan_type = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="completed")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    scan_result = Column(Text, nullable=True)
    vulnerabilities = Column(JSON, nullable=True)
    remediation_suggestions = Column(JSON, nullable=True)
    report_file_path = Column(String(255), nullable=True)

    # Relationships
    task = relationship("Task", back_populates="reports")
    project = relationship("Project", back_populates="reports")
    creator = relationship("User", back_populates="reports")
