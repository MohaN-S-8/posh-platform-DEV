from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnswerSubmit(BaseModel):
    question_id: int
    selected_option: str = Field(pattern="^[ABCDTF]$")


class AssessmentSubmit(BaseModel):
    video_id: int
    answers: list[AnswerSubmit]


class AssessmentOptionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    option_label: str = Field(pattern="^[ABCDTF]$")
    option_text: str = Field(min_length=1, max_length=1000)


class AssessmentQuestionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    video_id: int
    question_text: str = Field(min_length=1, max_length=4000)
    question_type: str = "MCQ"
    correct_option: str
    options: list[AssessmentOptionCreate]

    @model_validator(mode="after")
    def valid_answer(self):
        labels = [option.option_label for option in self.options]
        if len(labels) < 2 or len(labels) != len(set(labels)) or self.correct_option not in labels:
            raise ValueError(
                "Provide distinct options and select a correct answer from those options"
            )
        return self


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
