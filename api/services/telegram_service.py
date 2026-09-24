import logging
import asyncio
import httpx
from typing import Optional, Dict, Any
from .config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)


async def send_photo_to_telegram(
    photo_bytes: bytes,
    caption: str,
    chat_id: Optional[str] = None,
    filename: str = "report.png",
) -> Dict[str, Any]:
    bot_token = TELEGRAM_BOT_TOKEN
    target_chat_id = chat_id or TELEGRAM_CHAT_ID

    if not bot_token:
        raise ValueError("Chưa cấu hình TELEGRAM_BOT_TOKEN trong hệ thống.")
    if not target_chat_id:
        raise ValueError("Chưa cấu hình TELEGRAM_CHAT_ID trong hệ thống.")

    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"

    data = {
        "chat_id": str(target_chat_id),
        "caption": caption
    }

    timeout_config = httpx.Timeout(60.0, connect=20.0)
    last_error = None

    async with httpx.AsyncClient(timeout=timeout_config) as client:
        for attempt in range(3):
            files = {
                "photo": (filename, photo_bytes, "image/png")
            }
            try:
                response = await client.post(url, data=data, files=files)
                res_json = response.json()

                if response.status_code == 200 and res_json.get("ok"):
                    logger.info(f"Gửi ảnh lên Telegram thành công tới chat_id {target_chat_id}")
                    return res_json.get("result", {})

                error_desc = res_json.get("description", "Không rõ nguyên nhân")
                logger.warning(f"Telegram API trả về lỗi (lần {attempt+1}): {error_desc}")
                last_error = error_desc

                if res_json.get("error_code") == 429:
                    retry_after = res_json.get("parameters", {}).get("retry_after", 3)
                    await asyncio.sleep(retry_after)
                else:
                    await asyncio.sleep(1.0)
            except Exception as e:
                logger.error(f"Lỗi kết nối khi gửi ảnh Telegram (lần {attempt+1}): {e}")
                last_error = str(e)
                await asyncio.sleep(1.0)

    raise RuntimeError(f"Không thể gửi ảnh tới Telegram sau 3 lần thử: {last_error}")


async def delete_telegram_message(
    message_id: int,
    chat_id: Optional[str] = None
) -> bool:
    bot_token = TELEGRAM_BOT_TOKEN
    target_chat_id = chat_id or TELEGRAM_CHAT_ID

    if not bot_token:
        raise ValueError("Chưa cấu hình TELEGRAM_BOT_TOKEN.")
    if not target_chat_id:
        raise ValueError("Chưa cấu hình TELEGRAM_CHAT_ID.")

    url = f"https://api.telegram.org/bot{bot_token}/deleteMessage"
    data = {
        "chat_id": str(target_chat_id),
        "message_id": message_id
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, json=data)
        res_json = resp.json()
        if resp.status_code == 200 and res_json.get("ok"):
            logger.info(f"Đã xóa tin nhắn {message_id} trên Telegram thành công.")
            return True
        error_desc = res_json.get("description", "Không rõ nguyên nhân")
        raise RuntimeError(f"Lỗi xóa tin nhắn Telegram: {error_desc}")
