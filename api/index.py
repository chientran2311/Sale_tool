import base64
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .services.report_ai_service import generate_standardized_report, generate_combo_report_and_plan
from .services.report_image_service import render_report_image
from .services.telegram_service import send_photo_to_telegram, delete_telegram_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sale Tool Serverless API",
    version="1.0.0",
    description="Vercel Serverless Function cho tính năng Báo cáo & Kế hoạch AI",
)

# Cho phép CORS toàn bộ để frontend gọi mượt mà
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Schemas
class ReportGeneratePayload(BaseModel):
    mode: str = "report"
    report_date: str
    content: str
    assignee: Optional[str] = "Chiến Trần"


class ReportGenerateResponse(BaseModel):
    mode: str
    report_date: str
    caption: str
    summary_text: str
    image_data_url: str


class ReportSendPayload(BaseModel):
    mode: str = "report"
    report_date: str
    summary_text: str
    image_data_url: Optional[str] = None
    chat_id: Optional[str] = None
    assignee: Optional[str] = "Chiến Trần"


class ReportSendResponse(BaseModel):
    success: bool
    message: str
    chat_id: str
    message_id: Optional[int] = None
    caption: str
    summary_text: Optional[str] = None
    image_data_url: Optional[str] = None


class ReportItem(BaseModel):
    mode: str
    report_date: str
    caption: str
    summary_text: str
    image_data_url: str


class ReportComboGeneratePayload(BaseModel):
    report_date: str
    content: str
    assignee: Optional[str] = "Chiến Trần"


class ReportComboGenerateResponse(BaseModel):
    report: ReportItem
    plan: ReportItem


class RenderImageSection(BaseModel):
    num: str
    title: str
    items: List[str] = []


class RenderImagePayload(BaseModel):
    content: str
    title: Optional[str] = None
    assignee: Optional[str] = "Chiến Trần"
    sections: Optional[List[RenderImageSection]] = None


class RenderImageResponse(BaseModel):
    image_data_url: str


def get_short_caption(mode: str, report_date: str) -> str:
    try:
        parts = report_date.strip().split("-")
        if len(parts) == 3:
            _, month, day = parts
            label = "Kế hoạch" if mode == "plan" else "Báo cáo"
            return f"{label} {day}/{month}"
    except Exception:
        pass
    label = "Kế hoạch" if mode == "plan" else "Báo cáo"
    return label


# Routes
@app.get("/api/v1/health")
@app.get("/api/health")
@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Sale Tool Serverless API",
        "platform": "Vercel",
    }


@app.get("/api/v1/audio/records")
def mock_audio_records(limit: int = 10):
    """Giữ route này để frontend không bị lỗi 404 khi load audio records trên Vercel"""
    return []


@app.post("/api/v1/reports/generate", response_model=ReportGenerateResponse)
async def generate_report_endpoint(payload: ReportGeneratePayload):
    try:
        short_caption = get_short_caption(payload.mode, payload.report_date)

        summary_text = await generate_standardized_report(
            mode="plan" if payload.mode == "plan" else "report",
            report_date=payload.report_date,
            raw_content=payload.content,
        )

        _, data_url = render_report_image(
            summary_text,
            title=short_caption,
            assignee=payload.assignee or "Chiến Trần",
        )

        return ReportGenerateResponse(
            mode=payload.mode,
            report_date=payload.report_date,
            caption=short_caption,
            summary_text=summary_text,
            image_data_url=data_url,
        )
    except Exception as e:
        logger.error(f"Lỗi generate_report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/reports/generate-combo", response_model=ReportComboGenerateResponse)
async def generate_combo_endpoint(payload: ReportComboGeneratePayload):
    try:
        combo_res = await generate_combo_report_and_plan(
            report_date=payload.report_date,
            raw_content=payload.content,
        )
        assignee_name = payload.assignee or "Chiến Trần"
        _, rep_data_url = render_report_image(
            combo_res["report_text"],
            title=combo_res["report_caption"],
            assignee=assignee_name,
        )
        _, plan_data_url = render_report_image(
            combo_res["plan_text"],
            title=combo_res["plan_caption"],
            assignee=assignee_name,
        )
        return ReportComboGenerateResponse(
            report=ReportItem(
                mode="report",
                report_date=combo_res["report_date"],
                caption=combo_res["report_caption"],
                summary_text=combo_res["report_text"],
                image_data_url=rep_data_url,
            ),
            plan=ReportItem(
                mode="plan",
                report_date=combo_res["plan_date"],
                caption=combo_res["plan_caption"],
                summary_text=combo_res["plan_text"],
                image_data_url=plan_data_url,
            ),
        )
    except Exception as e:
        logger.error(f"Lỗi generate_combo: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/reports/render-image", response_model=RenderImageResponse)
async def render_image_endpoint(payload: RenderImagePayload):
    try:
        sections_dict = None
        if payload.sections is not None:
            sections_dict = [s.model_dump() for s in payload.sections]

        _, data_url = render_report_image(
            payload.content,
            title=payload.title,
            sections=sections_dict,
            assignee=payload.assignee or "Chiến Trần",
        )
        return RenderImageResponse(image_data_url=data_url)
    except Exception as e:
        logger.error(f"Lỗi render_image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/reports/send", response_model=ReportSendResponse)
async def send_report_endpoint(payload: ReportSendPayload):
    try:
        short_caption = get_short_caption(payload.mode, payload.report_date)

        if payload.image_data_url and "base64," in payload.image_data_url:
            raw_b64 = payload.image_data_url.split("base64,")[1]
            photo_bytes = base64.b64decode(raw_b64)
            data_url = payload.image_data_url
        else:
            photo_bytes, data_url = render_report_image(
                payload.summary_text,
                title=short_caption,
                assignee=payload.assignee or "Chiến Trần",
            )

        tele_result = await send_photo_to_telegram(
            photo_bytes=photo_bytes,
            caption=short_caption,
            chat_id=payload.chat_id,
            filename=f"{short_caption.replace(' ', '_')}.png",
        )

        chat_id_resp = str(tele_result.get("chat", {}).get("id", payload.chat_id or "default"))
        msg_id_resp = tele_result.get("message_id")

        return ReportSendResponse(
            success=True,
            message="Đã gửi ảnh kèm tin nhắn ngắn tới nhóm Telegram thành công!",
            chat_id=chat_id_resp,
            message_id=msg_id_resp,
            caption=short_caption,
            summary_text=payload.summary_text,
            image_data_url=data_url,
        )
    except Exception as e:
        logger.error(f"Lỗi send_report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class DeleteMessagePayload(BaseModel):
    message_id: int
    chat_id: Optional[str] = None


class DeleteMessageResponse(BaseModel):
    success: bool
    message: str


@app.post("/api/v1/reports/delete-message", response_model=DeleteMessageResponse)
async def delete_message_endpoint(payload: DeleteMessagePayload):
    try:
        await delete_telegram_message(
            message_id=payload.message_id,
            chat_id=payload.chat_id,
        )
        return DeleteMessageResponse(
            success=True,
            message="Đã xóa tin nhắn trên nhóm Telegram thành công!",
        )
    except Exception as e:
        logger.error(f"Lỗi delete_message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
