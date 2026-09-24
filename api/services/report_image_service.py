import io
import os
import re
import base64
from typing import List, Tuple, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

# Thư mục fonts nội bộ của dự án
ASSETS_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "fonts")
FONT_REG_PATH = os.path.join(ASSETS_FONT_DIR, "BeVietnamPro-Regular.ttf")
FONT_SEMI_PATH = os.path.join(ASSETS_FONT_DIR, "BeVietnamPro-SemiBold.ttf")
FONT_BOLD_PATH = os.path.join(ASSETS_FONT_DIR, "BeVietnamPro-Bold.ttf")

FALLBACK_SYSTEM_REGULAR = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\calibri.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]
FALLBACK_SYSTEM_BOLD = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\calibrib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def _get_font(size: int, weight: str = "regular") -> ImageFont.ImageFont:
    """Tải font BeVietnamPro (tối ưu tiếng Việt), tự động fallback nếu thiếu."""
    target_path = FONT_BOLD_PATH if weight == "bold" else (FONT_SEMI_PATH if weight == "semi" else FONT_REG_PATH)
    if os.path.exists(target_path):
        try:
            return ImageFont.truetype(target_path, size=size)
        except Exception:
            pass

    fallbacks = FALLBACK_SYSTEM_BOLD if weight in ("bold", "semi") else FALLBACK_SYSTEM_REGULAR
    for fb in fallbacks:
        if os.path.exists(fb):
            try:
                return ImageFont.truetype(fb, size=size)
            except Exception:
                continue

    return ImageFont.load_default()


def _wrap_text_lines(text: str, font: ImageFont.ImageFont, max_w: int, draw: ImageDraw.ImageDraw) -> List[str]:
    """Tự động ngắt dòng thông minh theo bề ngang cho phép."""
    lines = []
    for paragraph in text.split("\n"):
        p = paragraph.strip()
        if not p:
            continue
        words = p.split(" ")
        current = ""
        for w in words:
            test = f"{current} {w}".strip()
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] <= max_w:
                current = test
            else:
                if current:
                    lines.append(current)
                current = w
        if current:
            lines.append(current)
    return lines


# Danh mục từ khóa nhận diện tiêu đề của 5 mục chuẩn
STANDARD_SECTION_KEYWORDS = {
    "1": (["chốt đơn", "chot don"], "Chốt đơn"),
    "2": (["gặp mặt", "gap mat"], "Gặp mặt"),
    "3": (["gửi mẫu", "cắt mẫu", "gui mau", "cat mau"], "Gửi mẫu, cắt mẫu"),
    "4": (["liên hệ", "lien he"], "Liên hệ khách hàng"),
    "5": (["tồn đọng", "ton dong", "đăng bài", "dang bai"], "Công việc tồn đọng"),
}


def _parse_content_5_sections(text: str, fallback_title: str = "") -> Tuple[str, List[Dict[str, Any]]]:
    raw_lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    main_title = ""

    is_plan_mode = "kế hoạch" in (fallback_title or "").lower() or "kế hoạch" in text[:120].lower()
    default_sec5_title = "Đăng bài" if is_plan_mode else "Công việc tồn đọng"

    sections_map: Dict[str, Dict[str, Any]] = {
        "1": {"num": "1", "title": "Chốt đơn", "items": []},
        "2": {"num": "2", "title": "Gặp mặt", "items": []},
        "3": {"num": "3", "title": "Gửi mẫu, cắt mẫu", "items": []},
        "4": {"num": "4", "title": "Liên hệ khách hàng", "items": []},
        "5": {"num": "5", "title": default_sec5_title, "items": []},
    }

    extra_sections: List[Dict[str, Any]] = []
    current_key: Optional[str] = None
    first_line_seen = False

    header_patterns = [
        re.compile(r"^#+\s*(.+)$"),
        re.compile(r"^\*\*(.+?)\*\*$"),
        re.compile(r"^(báo cáo\s+\d+[\/\-]\d+|kế hoạch\s+\d+[\/\-]\d+)", re.IGNORECASE),
    ]

    for line in raw_lines:
        clean = line.replace("*", "").replace("#", "").strip()

        if not first_line_seen:
            first_line_seen = True
            is_title = False
            for pat in header_patterns:
                m = pat.match(line)
                if m:
                    main_title = clean
                    is_title = True
                    break
            if is_title:
                continue

        matched_key = None
        for key, (kw_list, canonical_title) in STANDARD_SECTION_KEYWORDS.items():
            pattern = rf"^({key}[\.\:\)\-\s]+)(.*)$"
            m = re.match(pattern, clean, re.IGNORECASE)
            if m:
                rest_of_line = m.group(2).strip().lower()
                for kw in kw_list:
                    if kw in rest_of_line or rest_of_line.startswith(kw):
                        matched_key = key
                        if key == "5":
                            if "đăng bài" in rest_of_line or "dang bai" in rest_of_line:
                                sections_map["5"]["title"] = "Đăng bài"
                            elif "tồn đọng" in rest_of_line or "ton dong" in rest_of_line:
                                sections_map["5"]["title"] = "Công việc tồn đọng"
                        break
            if matched_key:
                break

        if matched_key:
            current_key = matched_key
            continue

        extra_match = re.match(r"^([6-9]|\d{2,})[\.\:\)\-\s]+(.+)$", clean)
        if extra_match:
            sec_num = extra_match.group(1)
            sec_title = extra_match.group(2).strip()
            new_extra = {"num": sec_num, "title": sec_title, "items": []}
            extra_sections.append(new_extra)
            current_key = f"extra_{len(extra_sections)-1}"
            continue

        if current_key is not None:
            item_text = re.sub(r"^[\-\•\*\+\>\–\—\d+\.]\s*", "", clean).strip()
            if not item_text:
                item_text = clean
            if item_text:
                if current_key.startswith("extra_"):
                    idx = int(current_key.split("_")[1])
                    extra_sections[idx]["items"].append(item_text)
                else:
                    sections_map[current_key]["items"].append(item_text)
        else:
            if not main_title and any(k in clean.lower() for k in ["báo cáo", "kế hoạch"]):
                main_title = clean

    if not main_title:
        main_title = fallback_title or "Báo cáo công việc"

    final_sections = [
        sections_map["1"],
        sections_map["2"],
        sections_map["3"],
        sections_map["4"],
        sections_map["5"],
    ]
    final_sections.extend(extra_sections)

    return main_title, final_sections


SECTION_PALETTE = {
    "1": {"badge_bg": (245, 158, 11, 45), "badge_border": (245, 158, 11, 140), "badge_text": (251, 191, 36)},
    "2": {"badge_bg": (59, 130, 246, 45), "badge_border": (59, 130, 246, 140), "badge_text": (96, 165, 250)},
    "3": {"badge_bg": (139, 92, 246, 45), "badge_border": (139, 92, 246, 140), "badge_text": (167, 139, 250)},
    "4": {"badge_bg": (16, 185, 129, 45), "badge_border": (16, 185, 129, 140), "badge_text": (52, 211, 153)},
    "5": {"badge_bg": (244, 63, 94, 45), "badge_border": (244, 63, 94, 140), "badge_text": (251, 113, 133)},
    "6": {"badge_bg": (6, 182, 212, 45), "badge_border": (6, 182, 212, 140), "badge_text": (34, 211, 238)},
    "7": {"badge_bg": (236, 72, 153, 45), "badge_border": (236, 72, 153, 140), "badge_text": (244, 114, 182)},
    "8": {"badge_bg": (20, 184, 166, 45), "badge_border": (20, 184, 166, 140), "badge_text": (45, 212, 191)},
    "default": {"badge_bg": (99, 102, 241, 45), "badge_border": (99, 102, 241, 140), "badge_text": (129, 140, 248)},
}


def render_report_image(
    content: str,
    title: Optional[str] = None,
    sections: Optional[List[Dict[str, Any]]] = None
) -> Tuple[bytes, str]:
    if sections and len(sections) > 0:
        main_title = title or "Báo cáo công việc"
        parsed_sections = sections
    else:
        main_title, parsed_sections = _parse_content_5_sections(content, fallback_title=title or "")

    clean_title = main_title.replace("#", "").replace("*", "").strip()

    IMG_W = 1080
    PAD_X = 54
    CARD_W = IMG_W - (PAD_X * 2)

    font_title = _get_font(42, weight="bold")
    font_sec_title = _get_font(25, weight="semi")
    font_sec_num = _get_font(21, weight="bold")
    font_item = _get_font(22, weight="regular")
    font_tag = _get_font(17, weight="bold")
    font_zero = _get_font(22, weight="regular")

    dummy_img = Image.new("RGB", (IMG_W, 200))
    dummy_draw = ImageDraw.Draw(dummy_img)

    ITEM_TEXT_MAX_W = CARD_W - 84
    computed_cards = []

    for sec in parsed_sections:
        num = str(sec.get("num", "•"))
        stitle = sec.get("title", f"Mục {num}")
        items = sec.get("items", [])

        is_zero = False
        wrapped_lines: List[str] = []

        if not items:
            is_zero = True
        elif len(items) == 1 and items[0].strip() == "0":
            is_zero = True
        else:
            filtered_items = [it for it in items if it.strip() != "0"]
            if not filtered_items:
                is_zero = True
            else:
                for it in filtered_items:
                    bullet_text = f"• {it.strip()}"
                    wlines = _wrap_text_lines(bullet_text, font_item, ITEM_TEXT_MAX_W, dummy_draw)
                    wrapped_lines.extend(wlines)

        content_h = 28 if is_zero else max(28, len(wrapped_lines) * 32)
        card_h = 18 + 36 + 12 + content_h + 18
        computed_cards.append({
            "num": num,
            "title": stitle,
            "is_zero": is_zero,
            "lines": wrapped_lines,
            "height": card_h
        })

    HEADER_H = 175
    FOOTER_H = 65
    SPACING = 16
    total_cards_h = sum(c["height"] for c in computed_cards) + (len(computed_cards) - 1) * SPACING
    TOTAL_H = HEADER_H + total_cards_h + FOOTER_H
    TOTAL_H = max(1120, TOTAL_H)

    img = Image.new("RGBA", (IMG_W, TOTAL_H), (15, 17, 26, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    for y in range(TOTAL_H):
        ratio = y / TOTAL_H
        r = int(14 + (8 * (1 - ratio)))
        g = int(16 + (9 * (1 - ratio)))
        b = int(24 + (18 * (1 - ratio)))
        draw.line([(0, y), (IMG_W, y)], fill=(r, g, b, 255))

    draw.ellipse([-120, -120, 420, 420], fill=(59, 130, 246, 25))
    draw.ellipse([IMG_W - 350, 40, IMG_W + 180, 560], fill=(139, 92, 246, 20))

    tag_text = "ATTIO LUXURY DARK • SALES REPORT"
    tag_x, tag_y = PAD_X, 48
    draw.rounded_rectangle([tag_x, tag_y, tag_x + 360, tag_y + 32], radius=8, fill=(30, 41, 59, 220), outline=(59, 130, 246, 120), width=1)
    draw.text((tag_x + 18, tag_y + 6), tag_text, font=font_tag, fill=(147, 197, 253))

    title_y = tag_y + 44
    draw.text((PAD_X, title_y), clean_title, font=font_title, fill=(255, 255, 255))

    decor_line_y = title_y + 54
    draw.rectangle([PAD_X, decor_line_y, PAD_X + 160, decor_line_y + 3], fill=(59, 130, 246, 255))
    draw.rectangle([PAD_X + 165, decor_line_y, PAD_X + 220, decor_line_y + 3], fill=(139, 92, 246, 180))

    curr_y = HEADER_H
    for c in computed_cards:
        num = c["num"]
        card_h = c["height"]
        palette = SECTION_PALETTE.get(num, SECTION_PALETTE["default"])

        draw.rounded_rectangle([PAD_X, curr_y, PAD_X + CARD_W, curr_y + card_h], radius=16, fill=(24, 27, 41, 235), outline=(255, 255, 255, 22), width=1)

        b_x, b_y = PAD_X + 20, curr_y + 16
        b_size = 34
        draw.rounded_rectangle([b_x, b_y, b_x + b_size, b_y + b_size], radius=10, fill=palette["badge_bg"], outline=palette["badge_border"], width=1)

        nbox = draw.textbbox((0, 0), num, font=font_sec_num)
        nw, nh = nbox[2] - nbox[0], nbox[3] - nbox[1]
        nx = b_x + (b_size - nw) // 2
        ny = b_y + (b_size - nh) // 2 - 2
        draw.text((nx, ny), num, font=font_sec_num, fill=palette["badge_text"])

        stitle_x = b_x + b_size + 14
        stitle_y = b_y + 3
        draw.text((stitle_x, stitle_y), c["title"], font=font_sec_title, fill=(248, 250, 252))

        div_y = b_y + b_size + 12
        draw.line([(PAD_X + 20, div_y), (PAD_X + CARD_W - 20, div_y)], fill=(255, 255, 255, 12), width=1)

        item_y = div_y + 12
        if c["is_zero"]:
            draw.text((PAD_X + 24, item_y), "• Không có (0)", font=font_zero, fill=(100, 116, 139))
        else:
            for l in c["lines"]:
                draw.text((PAD_X + 24, item_y), l, font=font_item, fill=(226, 232, 240))
                item_y += 32

        curr_y += card_h + SPACING

    ft_y = TOTAL_H - 42
    draw.text((PAD_X, ft_y), "Hệ thống Báo cáo Tự động • Attio AI Sales Assistant", font=font_tag, fill=(100, 116, 139))
    draw.text((IMG_W - PAD_X - 180, ft_y), "Bảo mật & Chuẩn hóa", font=font_tag, fill=(71, 85, 105))

    out_rgb = img.convert("RGB")
    buf = io.BytesIO()
    out_rgb.save(buf, format="PNG", optimize=True)
    raw_bytes = buf.getvalue()
    b64_str = base64.b64encode(raw_bytes).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    return raw_bytes, data_url
