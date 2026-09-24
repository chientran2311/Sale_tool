import re
import logging
import asyncio
import httpx
from typing import Literal, List
from datetime import datetime
from .config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

GEMINI_MODELS: List[str] = [
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]

STANDARD_5_SECTIONS_PROMPT = """Bạn là trợ lý AI chuyên nghiệp cho nhân viên kinh doanh / quản lý bán hàng.
Nhiệm vụ của bạn là đọc nội dung ghi chép thô và chuyển đổi thành văn bản chuẩn theo đúng cấu trúc bắt buộc dưới đây.

CẤU TRÚC BẮT BUỘC (Bắt đầu trực tiếp từ dòng tiêu đề H1, KHÔNG chào hỏi, KHÔNG có câu dẫn dắt):

{header_title}

1. Chốt đơn
[Chi tiết đơn hàng chốt: sản phẩm, số lượng, khách hàng, giá... Nếu không có gì ghi số: 0]

2. Gặp mặt
[Chi tiết khách/đối tác đã gặp hoặc sẽ gặp, nội dung trao đổi... Nếu không có ghi số: 0]

3. Gửi mẫu, cắt mẫu
[Chi tiết mẫu vải/sản phẩm đã gửi hoặc cần cắt... Nếu không có ghi số: 0]

4. Liên hệ khách hàng
[Tên khách - mã/sđt: nội dung trao đổi, tư vấn, báo giá... Nếu không có ghi số: 0]

{sec_5_title}
{sec_5_desc}

QUY TẮC BẮT BUỘC:
1. Tiêu đề dòng đầu tiên phải đúng dạng: '{header_title}'.
2. Giữ nguyên đúng tên 5 mục:
   1. Chốt đơn
   2. Gặp mặt
   3. Gửi mẫu, cắt mẫu
   4. Liên hệ khách hàng
   {sec_5_title}
3. Dưới mỗi mục, nếu có thông tin thì gạch đầu dòng ngắn gọn, súc tích, chuyên nghiệp. Nếu hoàn toàn không có thông tin trong nội dung người dùng cung cấp thì CHỈ GHI DUY NHẤT một số 0.
{extra_rule}
"""


def _format_header_title(mode: Literal["plan", "report"], report_date: str) -> str:
    try:
        parts = report_date.strip().split("-")
        if len(parts) == 3:
            year, month, day = parts
            date_formatted = f"{day}/{month}"
        else:
            date_formatted = datetime.now().strftime("%d/%m")
    except Exception:
        date_formatted = datetime.now().strftime("%d/%m")

    label = "Kế hoạch" if mode == "plan" else "Báo cáo"
    return f"{label} {date_formatted}"


async def generate_standardized_report(
    mode: Literal["plan", "report"],
    report_date: str,
    raw_content: str
) -> str:
    header_title = _format_header_title(mode, report_date)

    if mode == "plan":
        sec_5_title = "5. Đăng bài"
        sec_5_desc = "[Kế hoạch đăng bài Facebook/Zalo/Tiktok, nội dung, sản phẩm... Nếu không có ghi số: 0]"
        extra_rule = "4. NẾU trong nội dung người dùng có đề cập đến các công việc, to-do hoặc nhiệm vụ khác (ngoài 5 mục trên), hãy tiếp tục đánh số các mục tiếp theo: 6. [Tên việc], 7. [Tên việc]... kèm nội dung chi tiết. Nếu không có việc bổ sung nào thì chỉ dừng lại ở 5 mục."
    else:
        sec_5_title = "5. Công việc tồn đọng"
        sec_5_desc = "[Các vấn đề vướng mắc, việc chưa xử lý xong, đơn nợ, việc cần làm tiếp, công nợ, nhiệm vụ tồn đọng... Nếu không có ghi số: 0]"
        extra_rule = "4. BẮT BUỘC VÀ TUYỆT ĐỐI: Báo cáo chỉ có ĐÚNG 5 MỤC (từ 1 đến 5). Mục 5 cuối cùng LUÔN LUÔN là '5. Công việc tồn đọng'. TUYỆT ĐỐI KHÔNG BAO GIỜ TẠO MỤC 6, không có mục to-do bổ sung. Toàn bộ các vấn đề phát sinh, công việc cần làm, tồn đọng phải đưa hết vào mục 5. Bắt buộc phải xuất hiện đủ cả 5 mục (mục nào không có thông tin thì ghi duy nhất số: 0)."

    system_instruction = STANDARD_5_SECTIONS_PROMPT.format(
        header_title=header_title,
        sec_5_title=sec_5_title,
        sec_5_desc=sec_5_desc,
        extra_rule=extra_rule,
    )

    user_message = (
        f"Dưới đây là thông tin ghi chép thô của tôi:\n"
        f"---------------------\n"
        f"{raw_content}\n"
        f"---------------------\n"
        f"Hãy tổng hợp và tạo đúng cấu trúc chuẩn 5 mục bắt đầu bằng tiêu đề '{header_title}'."
    )

    api_key = GEMINI_API_KEY
    if not api_key:
        raise ValueError("Chưa cấu hình GEMINI_API_KEY")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"{system_instruction}\n\n{user_message}"}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048,
        }
    }

    last_error = None
    timeout = httpx.Timeout(45.0, connect=10.0)

    def _enforce_strict_structure(text: str) -> str:
        lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
        canonical = {
            "1": "Chốt đơn",
            "2": "Gặp mặt",
            "3": "Gửi mẫu, cắt mẫu",
            "4": "Liên hệ khách hàng",
            "5": "Đăng bài" if mode == "plan" else "Công việc tồn đọng",
        }
        sec_data = {k: [] for k in canonical}
        extra_secs = []
        curr_key = None

        for line in lines:
            if line.lower().startswith(("báo cáo", "kế hoạch", "#", "tiêu đề:")):
                continue

            m_head = re.match(r"^(?:###\s*)?(\d+)[\.\:\)]\s*(.*)$", line)
            if m_head:
                num = m_head.group(1)
                rest = m_head.group(2).strip()
                if num in canonical:
                    curr_key = num
                    continue
                elif mode == "plan" and int(num) >= 6:
                    curr_key = num
                    extra_secs.append((num, rest if rest else f"Công việc #{num}", []))
                    continue
                elif mode == "report" and int(num) >= 6:
                    curr_key = "5"
                    if rest:
                        sec_data["5"].append(f"- {rest}")
                    continue

            if curr_key in sec_data:
                sec_data[curr_key].append(line)
            elif extra_secs and curr_key == extra_secs[-1][0]:
                extra_secs[-1][2].append(line)

        out_lines = [header_title, ""]
        for k in ["1", "2", "3", "4", "5"]:
            out_lines.append(f"{k}. {canonical[k]}")
            items = sec_data[k]
            if not items:
                out_lines.append("0")
            else:
                for it in items:
                    out_lines.append(it)
            out_lines.append("")

        if mode == "plan":
            for num, title, items in extra_secs:
                out_lines.append(f"{num}. {title}")
                if not items:
                    out_lines.append("0")
                else:
                    for it in items:
                        out_lines.append(it)
                out_lines.append("")

        return "\n".join(out_lines).strip()

    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in GEMINI_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                logger.info(f"Đang gọi Gemini REST API với model {model}...")
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_parts = candidates[0].get("content", {}).get("parts", [])
                        if text_parts:
                            result_text = text_parts[0].get("text", "").strip()
                            if result_text:
                                logger.info(f"Model {model} đã tạo nội dung thành công!")
                                return _enforce_strict_structure(result_text)
                else:
                    logger.warning(f"Model {model} trả về status {resp.status_code}: {resp.text[:200]}")
                    last_error = f"Status {resp.status_code}: {resp.text[:200]}"
            except Exception as e:
                logger.warning(f"Lỗi khi gọi model {model}: {e}")
                last_error = str(e)
            
            await asyncio.sleep(0.5)

    raise RuntimeError(f"Tất cả các model Gemini đều không phản hồi. Lỗi gần nhất: {last_error}")
