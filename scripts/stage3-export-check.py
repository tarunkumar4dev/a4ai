"""Stage 3b: checks the Test Generator's PDF / DOCX / answer-key export output (local, no server, no AI, no network).

The frontend sends the paper to POST /api/v1/test-generator/export (and /export-answer-key); the backend renders the
file. This script calls the same backend render functions directly with a paper shaped like the frontend payload,
then opens each file and checks what is inside it.

Usage:  python scripts/stage3-export-check.py <path to RAG-BACKEND-local/test-generator-backend> <out dir>
"""
import inspect
import io
import json
import sys
from pathlib import Path

backend, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(backend))

import fitz  # PyMuPDF
from docx import Document
from app.services import export_service as ex

# Unique tokens so text extraction can find each part even when lines wrap.
QUESTIONS = [
    {"id": "q1", "text": "QALPHA Which gas is released when zinc reacts with dilute sulphuric acid?",
     "options": ["Oxygen", "Hydrogen", "Nitrogen", "Chlorine"], "correctAnswer": "B",
     "explanation": "XPLONE Zinc displaces hydrogen from the acid.", "marks": 1, "difficulty": "Easy", "format": "mcq"},
    {"id": "q2", "text": "QBRAVO Which of these is a decomposition reaction?",
     "options": ["Burning of coal", "Heating calcium carbonate", "Rusting of iron", "Neutralisation"], "correctAnswer": "B",
     "explanation": "XPLTWO Calcium carbonate splits into calcium oxide and carbon dioxide.", "marks": 1, "difficulty": "Medium", "format": "mcq"},
    {"id": "q3", "text": "QCHARLIE The pH of pure water at 25 degrees C is",
     "options": ["5", "7", "9", "14"], "correctAnswer": "B",
     "explanation": "XPLTHREE Pure water is neutral.", "marks": 1, "difficulty": "Easy", "format": "mcq"},
    {"id": "q4", "text": "QDELTA Why should a magnesium ribbon be cleaned before burning?",
     "options": [], "correctAnswer": "ANSDELTA To remove the oxide layer so it burns readily.",
     "explanation": "XPLFOUR The oxide layer stops the reaction.", "marks": 2, "difficulty": "Medium", "format": "short_answer"},
    {"id": "q5", "text": "QECHO Explain the types of chemical reactions with one example each.",
     "options": [], "correctAnswer": "ANSECHO Combination, decomposition, displacement, double displacement, redox.",
     "explanation": "XPLFIVE One balanced equation for each type.", "marks": 5, "difficulty": "Hard", "format": "long_answer"},
]
TOTAL = sum(q["marks"] for q in QUESTIONS)  # 10
Q_TOKENS = ["QALPHA", "QBRAVO", "QCHARLIE", "QDELTA", "QECHO"]
ANSWER_TOKENS = ["ANSDELTA", "ANSECHO"]
EXPL_TOKENS = ["XPLONE", "XPLTWO", "XPLTHREE", "XPLFOUR", "XPLFIVE"]
META = dict(exam_title="Unit Test Chemical Reactions", board="CBSE", class_grade="10", subject="Science", paper_date="2026-10-28")


def call(fn, **kw):
    params = inspect.signature(fn).parameters
    return fn(questions=[dict(q) for q in QUESTIONS], **{k: v for k, v in {**META, **kw}.items() if k in params})


def pdf_text(data: bytes):
    doc = fitz.open(stream=data, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)
    return doc.page_count, text


def docx_text(data: bytes):
    d = Document(io.BytesIO(data))
    parts = [p.text for p in d.paragraphs]
    for t in d.tables:
        for row in t.rows:
            for cell in row.cells:
                parts.append(cell.text)
    return "\n".join(parts)


def check(name, data, kind, expect_answers, expect_expl, expect_questions=True):
    (out_dir / f"{name}.{kind}").write_bytes(data)
    if kind == "pdf":
        assert data[:5] == b"%PDF-", "not a PDF"
        pages, text = pdf_text(data)
    else:
        assert data[:2] == b"PK", "not a DOCX (zip)"
        pages, text = None, docx_text(data)
    flat = " ".join(text.split())
    r = {
        "file": f"{name}.{kind}",
        "bytes": len(data),
        "pages": pages,
        "questionsFound": sum(t in flat for t in Q_TOKENS),
        "optionTextFound": all(o in flat for o in ["Hydrogen", "Heating calcium carbonate"]),
        "writtenAnswersFound": sum(t in flat for t in ANSWER_TOKENS),
        "explanationsFound": sum(t in flat for t in EXPL_TOKENS),
        "totalMarksShown": f"{TOTAL}" in flat and ("Marks" in flat or "marks" in flat),
        "titleShown": "Unit Test Chemical Reactions" in flat,
    }
    # an answer key lists answers, not the questions
    ok = (r["questionsFound"] == 5 if expect_questions else True) and r["optionTextFound"] and r["titleShown"]
    ok = ok and ((r["writtenAnswersFound"] == 2) if expect_answers else (r["writtenAnswersFound"] == 0))
    if expect_expl is not None:
        ok = ok and ((r["explanationsFound"] >= 1) if expect_expl else (r["explanationsFound"] == 0))
    r["status"] = "PASS" if ok else "FAIL"
    return r


results = []
for tpl in ["modern", "teal", "colorful"]:
    results.append(check(f"student-{tpl}", call(ex.generate_pdf, include_answers=False, include_explanations=False, template=tpl), "pdf", False, False))
results.append(check("answers-modern", call(ex.generate_pdf, include_answers=True, include_explanations=False, template="modern"), "pdf", True, None))
results.append(check("teacher-modern", call(ex.generate_pdf, include_answers=True, include_explanations=True, template="modern"), "pdf", True, True))
results.append(check("student-modern", call(ex.generate_docx, include_answers=False, include_explanations=False, template="modern"), "docx", False, False))
# the download menu's three DOCX modes: student / answers / teacher (answers + explanations), on every template
for tpl in ["modern", "classic", "compact", "colorful", "teal", "navy", "dark_green", "orange"]:
    results.append(check(f"answers-{tpl}", call(ex.generate_docx, include_answers=True, include_explanations=False, template=tpl), "docx", True, None))
    results.append(check(f"teacher-{tpl}", call(ex.generate_docx, include_answers=True, include_explanations=True, template=tpl), "docx", True, True))
results.append(check("answer-key", call(ex.generate_answer_key_pdf, include_explanations=True, template="teal"), "pdf", True, None, expect_questions=False))
results.append(check("answer-key", call(ex.generate_answer_key_docx, include_explanations=True, template="teal"), "docx", True, None, expect_questions=False))
for r in results:
    print(f'{r["status"]:4}  {r["file"]:24} pages={r["pages"]} questions={r["questionsFound"]}/5 answers={r["writtenAnswersFound"]}/2 '
          f'explanations={r["explanationsFound"]}/5 totalMarks={r["totalMarksShown"]}')
