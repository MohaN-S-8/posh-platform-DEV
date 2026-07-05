from typing import Optional

from pydantic import BaseModel


class AnswerSubmit(BaseModel):
    question_id: int
    selected_option: str  # A, B, C, D, T, or F


class AssessmentSubmit(BaseModel):
    video_id: int
    answers: list[AnswerSubmit]


class AssessmentOptionCreate(BaseModel):
    option_label: str
    option_text: str


class AssessmentQuestionCreate(BaseModel):
    video_id: int
    question_text: str
    question_type: str = "MCQ"
    correct_option: str
    options: list[AssessmentOptionCreate]


class AssessmentOptionResponse(BaseModel):
    option_id: int
    option_label: str
    option_text: str

    class Config:
        from_attributes = True


class AssessmentQuestionResponse(BaseModel):
    question_id: int
    video_id: int
    question_text: str
    question_type: str
    options: list[AssessmentOptionResponse]

    class Config:
        from_attributes = True
