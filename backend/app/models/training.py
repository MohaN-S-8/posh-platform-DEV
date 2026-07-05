from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.sql import func

from app.db.base import Base


class TrainingHistory(Base):
    """Tracks every user's progress on every video."""

    __tablename__ = "training_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    video_id = Column(Integer, ForeignKey("video_master.video_id"))
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    watched_seconds = Column(Integer, default=0)
    total_seconds = Column(Integer)
    completion_percent = Column(Numeric(5, 2), default=0)
    furthest_position = Column(Integer, default=0)  # for no-fast-forward enforcement
    last_watched_position = Column(Integer, default=0)  # for resume
    status = Column(Enum("Not Started", "In Progress", "Completed"), default="Not Started")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())


class CourseAssignment(Base):
    """HR assigns videos to users/departments/company-wide."""

    __tablename__ = "course_assignment"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("video_master.video_id"))
    assigned_by = Column(BigInteger, ForeignKey("user_master.user_id"))
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    assigned_to_user_id = Column(BigInteger, ForeignKey("user_master.user_id"), nullable=True)
    assigned_to_department = Column(String(100), nullable=True)
    assign_type = Column(Enum("Individual", "Department", "Company-Wide"))
    due_date = Column(DateTime)
    passing_score = Column(Numeric(5, 2), default=70.0)
    created_date = Column(DateTime, server_default=func.now())


class AssessmentQuestion(Base):
    """Questions for a video's assessment."""

    __tablename__ = "assessment_question"

    question_id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("video_master.video_id"))
    question_text = Column(String(500))
    question_type = Column(Enum("MCQ", "True/False", "Scenario"))
    correct_option = Column(String(1))  # A, B, C, D or T/F
    created_date = Column(DateTime, server_default=func.now())


class AssessmentOption(Base):
    """Answer options for MCQ questions."""

    __tablename__ = "assessment_option"

    option_id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("assessment_question.question_id"))
    option_label = Column(String(1))  # A, B, C, D
    option_text = Column(String(500))


class AssessmentResult(Base):
    """Stores each attempt's result."""

    __tablename__ = "assessment_result"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    video_id = Column(Integer, ForeignKey("video_master.video_id"))
    total_questions = Column(Integer)
    correct_answers = Column(Integer)
    score = Column(Numeric(5, 2))
    passing_score = Column(Numeric(5, 2))
    result = Column(Enum("Pass", "Fail"))
    attempt_number = Column(Integer, default=1)
    attempted_at = Column(DateTime, server_default=func.now())
