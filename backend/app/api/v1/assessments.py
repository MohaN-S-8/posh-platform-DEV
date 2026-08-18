import re
import zipfile
from io import BytesIO
from xml.etree import ElementTree

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_any_permission, require_permission, require_role
from app.db.session import get_db
from app.schemas.assessment import (
    AssessmentQuestionCreate,
    AssessmentQuestionResponse,
    AssessmentSubmit,
)
from app.services.assessment_service import AssessmentService
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/assessments", tags=["Assessments"])
assessment_service = AssessmentService()


def _docx_lines(file_bytes: bytes) -> list[str]:
    try:
        with zipfile.ZipFile(BytesIO(file_bytes)) as docx:
            document_xml = docx.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise HTTPException(400, "Please upload a valid .docx question file.") from exc

    root = ElementTree.fromstring(document_xml)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        text = " ".join(text.split())
        if text:
            lines.append(text)
    return lines


def _parse_docx_questions(lines: list[str], video_id: int) -> list[AssessmentQuestionCreate]:
    questions = []
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text).strip()
    question_start_pattern = re.compile(r"(?:^|\s)(?:question\s*)?(\d+)\s*[\).]\s+", re.I)
    starts = list(question_start_pattern.finditer(text))

    def build_question(question_text: str, options: list[dict], correct_option: str) -> None:
        if not question_text or not correct_option:
            raise HTTPException(
                400,
                "Each DOCX question must include question text and Answer: A/B/C/D.",
            )
        if len(options) < 2:
            raise HTTPException(400, "Each DOCX question must include at least two options.")
        if correct_option not in {option["option_label"] for option in options}:
            raise HTTPException(
                400,
                f"Answer {correct_option} does not match any option in: {question_text[:80]}",
            )

        questions.append(
            AssessmentQuestionCreate(
                video_id=video_id,
                question_text=question_text,
                question_type="MCQ",
                correct_option=correct_option,
                options=options,
            )
        )

    if starts:
        answer_pattern = re.compile(
            r"(?:correct\s+answer|answer|correct)\s*[:\-]?\s*([A-Da-d])(?:\b|[\).])",
            re.I,
        )
        option_pattern = re.compile(r"([A-Da-d])\s*[\).]\s*")

        for index, start in enumerate(starts):
            block_start = start.end()
            block_end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
            block = text[block_start:block_end].strip()
            answer_match = answer_pattern.search(block)
            if not answer_match:
                raise HTTPException(
                    400,
                    f"Question {start.group(1)} is missing Answer: A/B/C/D.",
                )

            correct_option = answer_match.group(1).upper()
            body = block[: answer_match.start()].strip()
            option_matches = list(option_pattern.finditer(body))
            if not option_matches:
                raise HTTPException(
                    400,
                    f"Question {start.group(1)} is missing options A/B/C/D.",
                )

            question_text = body[: option_matches[0].start()].strip()
            options = []
            for option_index, option_match in enumerate(option_matches):
                option_end = (
                    option_matches[option_index + 1].start()
                    if option_index + 1 < len(option_matches)
                    else len(body)
                )
                option_text = body[option_match.end() : option_end].strip()
                options.append(
                    {
                        "option_label": option_match.group(1).upper(),
                        "option_text": option_text,
                    }
                )

            build_question(question_text, options, correct_option)
    else:
        current = None
        option_pattern = re.compile(r"^(?:option\s*)?([A-Da-d])[\).:\-]\s*(.+)$")
        answer_pattern = re.compile(
            r"^(?:correct\s+answer|answer|correct)[:\s\-]*([A-Da-d])\b", re.I
        )
        question_pattern = re.compile(r"^(?:q(?:uestion)?\s*\d*[\).:\-]?|\d+[\).])\s*(.+)$", re.I)

        def push_current():
            if not current:
                return
            build_question(
                current["question_text"],
                current["options"],
                current["correct_option"],
            )

        for line in lines:
            question_match = question_pattern.match(line)
            option_match = option_pattern.match(line)
            answer_match = answer_pattern.match(line)

            if question_match:
                push_current()
                current = {
                    "question_text": question_match.group(1).strip(),
                    "options": [],
                    "correct_option": "",
                }
                continue

            if current is None:
                current = {"question_text": line.strip(), "options": [], "correct_option": ""}
                continue

            if option_match:
                current["options"].append(
                    {
                        "option_label": option_match.group(1).upper(),
                        "option_text": option_match.group(2).strip(),
                    }
                )
                continue

            if answer_match:
                current["correct_option"] = answer_match.group(1).upper()
                continue

            if current["options"]:
                current["options"][-1][
                    "option_text"
                ] = f"{current['options'][-1]['option_text']} {line}".strip()
            else:
                current["question_text"] = f"{current['question_text']} {line}".strip()

        push_current()

    if not questions:
        raise HTTPException(
            400,
            "No questions found. Use: Question 1..., A) ..., B) ..., Correct Answer: A.",
        )
    return questions


@router.get("/{video_id}/questions", response_model=list[AssessmentQuestionResponse])
async def get_questions(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(4)),
):
    """Return assessment questions/options for a published company video."""
    return await assessment_service.questions(
        db, video_id, current_user.company_id, current_user.user_id
    )


@router.get("/{video_id}/availability")
async def assessment_availability(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(4)),
):
    """Return whether the current user can take the assessment."""
    return await assessment_service.availability(
        db, video_id, current_user.user_id, current_user.company_id
    )


@router.post("/questions", status_code=201)
async def create_assessment_question(
    data: AssessmentQuestionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Admin: add an assessment question/options for a company video."""
    result = await assessment_service.create_question(db, data, current_user.company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="ASSESSMENT_QUESTION_CREATED",
        table_name="assessment_question",
        record_id=result["question_id"],
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/{video_id}/questions/import", status_code=201)
async def import_assessment_questions(
    video_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_any_permission(["videos.upload", "videos.manage"])),
):
    """Import assessment questions from a Word .docx file for a company video."""
    filename = file.filename or ""
    if not filename.lower().endswith(".docx"):
        raise HTTPException(400, "Assessment questions must be uploaded as a .docx file.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Question file is empty.")

    imported = 0
    for question in _parse_docx_questions(_docx_lines(file_bytes), video_id):
        await assessment_service.create_question(db, question, current_user.company_id)
        imported += 1

    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="ASSESSMENT_QUESTIONS_IMPORTED",
        table_name="assessment_question",
        record_id=video_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {"message": f"Imported {imported} assessment questions.", "imported": imported}


@router.delete("/questions/{question_id}")
async def delete_assessment_question(
    question_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Admin: delete an assessment question."""
    result = await assessment_service.delete_question(db, question_id, current_user.company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="ASSESSMENT_QUESTION_DELETED",
        table_name="assessment_question",
        record_id=question_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/submit")
async def submit_assessment(
    data: AssessmentSubmit,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(4)),
):
    """
    Submit assessment answers.
    Assessment is locked until video is 95%+ complete.
    Returns score, pass/fail, and triggers certificate on Pass.
    """

    return await assessment_service.submit(db, current_user.user_id, data, current_user.company_id)
