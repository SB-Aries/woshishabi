from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    scan_type = Column(String(20), nullable=False)  # full, quick, custom
    status = Column(String(20), default="pending")  # pending, running, completed, failed, stopped
    scan_result = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    target_url = Column(String(255), nullable=False)
    is_recurring = Column(Boolean, default=False)
    cron_expression = Column(String(50), nullable=True)
    progress = Column(Integer, default=0)
    next_run = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    creator = relationship("User")
    reports = relationship("Report", back_populates="task", cascade="all, delete-orphan")
