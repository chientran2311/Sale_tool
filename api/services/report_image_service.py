import io
import os
import re
import base64
from typing import List, Tuple, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

# Danh sách các thư mục font ứng viên (hỗ trợ cả Local Windows và Vercel Linux Serverless)
def _get_font(size: int, weight: str = "regular") -> ImageFont.ImageFont:
    """Tải font BeVietnamPro (tối ưu tiếng Việt), tự động fallback nếu thiếu."""
    candidate_dirs = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "fonts"),
        os.path.join(os.path.dirname(__file__), "..", "assets", "fonts"),
        os.path.join(os.getcwd(), "api", "assets", "fonts"),
        os.path.join(os.getcwd(), "assets", "fonts"),
        "/var/task/api/assets/fonts",
        r"C:\Project Code\sale_tool\api\assets\fonts",
    ]

    font_file_map = {
        "bold": "BeVietnamPro-Bold.ttf",
        "semi": "BeVietnamPro-SemiBold.ttf",
        "regular": "BeVietnamPro-Regular.ttf",
    }

    fname = font_file_map.get(weight, "BeVietnamPro-Regular.ttf")
    for fdir in candidate_dirs:
        fpath = os.path.join(fdir, fname)
        if os.path.exists(fpath):
            try:
                return ImageFont.truetype(fpath, size=size)
            except Exception:
                pass

    fallbacks_bold = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\calibrib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ]
    fallbacks_regular = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]

    fallbacks = fallbacks_bold if weight in ("bold", "semi") else fallbacks_regular
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


# 5 mục cố định chuẩn
STANDARD_SECTION_KEYWORDS = {
    "1": (["chốt đơn", "chot don"], "Chốt đơn"),
    "2": (["gặp mặt", "gap mat"], "Gặp mặt"),
    "3": (["gửi mẫu", "cắt mẫu", "gui mau", "cat mau"], "Gửi mẫu, cắt mẫu"),
    "4": (["liên hệ", "lien he"], "Liên hệ khách hàng"),
    "5": (["tồn đọng", "ton dong", "đăng bài", "dang bai"], "Công việc tồn đọng"),
}

# Bảng màu Enterprise hiện đại cho từng mục
SECTION_PALETTES = {
    "1": {"bg": (217, 119, 6), "border": (251, 191, 36), "name": "Chốt đơn"},
    "2": {"bg": (37, 99, 235), "border": (96, 165, 250), "name": "Gặp mặt"},
    "3": {"bg": (124, 58, 237), "border": (167, 139, 250), "name": "Gửi mẫu, cắt mẫu"},
    "4": {"bg": (5, 150, 105), "border": (52, 211, 153), "name": "Liên hệ"},
    "5": {"bg": (225, 29, 72), "border": (251, 113, 133), "name": "Tồn đọng/Đăng bài"},
    "6": {"bg": (8, 145, 178), "border": (34, 211, 238), "name": "To-do #6"},
    "7": {"bg": (219, 39, 119), "border": (244, 114, 182), "name": "To-do #7"},
    "8": {"bg": (79, 70, 229), "border": (129, 140, 248), "name": "To-do #8"},
    "9": {"bg": (13, 148, 136), "border": (45, 212, 191), "name": "To-do #9"},
    "default": {"bg": (71, 85, 105), "border": (148, 163, 184), "name": "Mục"},
}


def _parse_content_5_sections(text: str, fallback_title: str = "") -> Tuple[str, List[Dict[str, Any]]]:
    """
    Phân tách nội dung thành:
    - Tiêu đề H1 (vd: Báo cáo 24/09 hoặc Kế hoạch 25/09)
    - 5 mục chuẩn
    - Các mục bổ sung (To-do list mục 6, 7, 8...) nếu có.
    """
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

    current_num = None
    extra_sections_order: List[str] = []

    for line in raw_lines:
        if not main_title and (
            line.lower().startswith("báo cáo")
            or line.lower().startswith("kế hoạch")
            or line.lower().startswith("tiêu đề:")
            or line.startswith("# ")
        ):
            main_title = line.replace("Tiêu đề:", "").replace("#", "").strip()
            continue

        match_header = re.match(r"^(?:###\s*)?(\d+)[\.\:\)]\s*(.*)$", line)
        is_header = False

        if match_header:
            num = match_header.group(1)
            rest = match_header.group(2).strip()
            rest_lower = rest.lower()

            if num in STANDARD_SECTION_KEYWORDS:
                keywords, default_title = STANDARD_SECTION_KEYWORDS[num]
                if any(kw in rest_lower for kw in keywords):
                    is_header = True
                    current_num = num
                    if num == "5":
                        if "đăng bài" in rest_lower or "dang bai" in rest_lower:
                            sections_map["5"]["title"] = "Đăng bài"
                        else:
                            sections_map["5"]["title"] = "Công việc tồn đọng"
                    else:
                        sections_map[num]["title"] = default_title
            elif int(num) >= 6 and rest:
                if is_plan_mode:
                    is_header = True
                    current_num = num
                    if num not in sections_map:
                        sections_map[num] = {"num": num, "title": rest, "items": []}
                        extra_sections_order.append(num)
                else:
                    current_num = "5"
                    sections_map["5"]["items"].append(f"- {rest}")

        if is_header:
            continue

        if current_num and current_num in sections_map:
            sections_map[current_num]["items"].append(line)

    if not main_title:
        main_title = fallback_title or ("Kế hoạch công việc" if is_plan_mode else "Báo cáo công việc")

    sections_list = []
    allowed_extras = extra_sections_order if is_plan_mode else []
    for num_str in ["1", "2", "3", "4", "5"] + allowed_extras:
        sec = sections_map[num_str]
        if not sec["items"]:
            if int(num_str) >= 6 and sec["title"]:
                # Nếu người dùng chỉ gõ dòng '6. Nội dung công việc...', chuyển thành item
                sec["items"] = [sec["title"]]
                sec["title"] = f"Công việc #{num_str}"
            else:
                sec["items"] = ["0"]
        sections_list.append(sec)

    return main_title, sections_list


def render_report_image(
    content: str = "",
    title: Optional[str] = None,
    sections: Optional[List[Dict[str, Any]]] = None,
    assignee: str = "Chiến Trần",
    subtitle: Optional[str] = None,
    width: int = 880,
    **kwargs,
) -> Tuple[bytes, str]:
    """
    Render ảnh thẻ Báo cáo / Kế hoạch chuẩn doanh nghiệp cao cấp:
    - Nổi bật người phụ trách: Chiến Trần (trong badge header và signature footer)
    - Giao diện Dark Mode Modern & Elegant (Attio Obsidian Enterprise)
    - Card rõ ràng, phân cấp thị giác tinh tế, font tiếng Việt BeVietnamPro chuẩn.
    """
    # 1. Chuẩn hóa dữ liệu đầu vào
    if sections and len(sections) > 0:
        main_title = title or "Báo cáo công việc"
        cleaned_sections = []
        for s in sections:
            num = str(s.get("num", ""))
            t = str(s.get("title", ""))
            raw_items = s.get("items", [])
            items = [str(it).strip() for it in raw_items if str(it).strip()]
            if not items:
                items = ["0"]
            cleaned_sections.append({"num": num, "title": t, "items": items})
        parsed_sections = cleaned_sections
    else:
        main_title, parsed_sections = _parse_content_5_sections(content, fallback_title=title or "")

    if title:
        main_title = title

    clean_title = main_title.replace("#", "").replace("*", "").strip()

    # Layout constants
    IMG_W = width
    PAD_X = 40
    CARD_W = IMG_W - (PAD_X * 2)

    # Fonts
    f_h1 = _get_font(34, "bold")
    f_meta_bold = _get_font(13, "bold")
    f_meta_reg = _get_font(13, "regular")
    f_sec_num = _get_font(17, "bold")
    f_sec_title = _get_font(18, "semi")
    f_badge_tag = _get_font(11, "bold")
    f_body = _get_font(15, "regular")
    f_body_bold = _get_font(15, "semi")
    f_footer = _get_font(12, "regular")
    f_footer_bold = _get_font(12, "bold")

    dummy_img = Image.new("RGB", (IMG_W, 200))
    dummy_draw = ImageDraw.Draw(dummy_img)

    ITEM_MAX_W = CARD_W - 64

    # 2. Tính toán chiều cao các cards
    computed_cards = []
    for sec in parsed_sections:
        num = str(sec.get("num", "•"))
        stitle = sec.get("title", f"Mục {num}")
        items = sec.get("items", [])

        is_zero = False
        parsed_items: List[Dict[str, Any]] = []

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
                    raw_text = it.strip()
                    if raw_text.startswith("- ") or raw_text.startswith("* "):
                        raw_text = raw_text[2:].strip()

                    is_hl = raw_text.startswith("→") or raw_text.startswith("->") or "trọng tâm" in raw_text.lower()
                    curr_font = f_body_bold if is_hl else f_body

                    # Ngắt dòng theo text thực tế
                    wlines = _wrap_text_lines(raw_text, curr_font, ITEM_MAX_W - 20, dummy_draw)
                    parsed_items.append({
                        "lines": wlines,
                        "is_hl": is_hl,
                    })

        # Chiều cao card:
        # Header: pad_top (14) + badge (30) + spacing (10) + divider (1) + spacing (10)
        c_h = 14 + 30 + 10 + 1 + 10
        if is_zero:
            c_h += 26
        else:
            total_lines_count = sum(len(pi["lines"]) for pi in parsed_items)
            c_h += total_lines_count * 26 + (len(parsed_items) - 1) * 6
        c_h += 14  # bottom padding

        computed_cards.append({
            "num": num,
            "title": stitle,
            "is_zero": is_zero,
            "items": parsed_items,
            "item_count": len(parsed_items) if not is_zero else 0,
            "height": c_h,
        })

    # Header & Footer dimensions
    HEADER_H = 34 + 28 + 14 + 42 + 12 + 32 + 16 + 1 + 16
    FOOTER_H = 58
    CARD_SPACING = 14
    total_cards_h = sum(c["height"] for c in computed_cards) + (len(computed_cards) - 1) * CARD_SPACING
    TOTAL_H = HEADER_H + total_cards_h + FOOTER_H

    # 3. Canvas với gradient nền Dark Obsidian siêu sạch và mượt
    img = Image.new("RGBA", (IMG_W, TOTAL_H), (11, 14, 23, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    # Gradient nền thanh lịch
    for y in range(TOTAL_H):
        ratio = y / float(TOTAL_H)
        r = int(11 + 5 * ratio)
        g = int(14 + 7 * ratio)
        b = int(23 + 11 * ratio)
        draw.line([(0, y), (IMG_W, y)], fill=(r, g, b, 255))

    # Top accent line 3px (Electric Blue -> Purple Indigo)
    for y in range(3):
        alpha = int(255 * (1 - y / 3.0) * 0.95)
        draw.line([(0, y), (IMG_W // 2, y)], fill=(59, 130, 246, alpha))
        draw.line([(IMG_W // 2, y), (IMG_W, y)], fill=(139, 92, 246, alpha))

    # --- VẼ HEADER ---
    curr_y = 34

    # Row 1: System Badges
    tag1_w = 264
    draw.rounded_rectangle(
        [PAD_X, curr_y, PAD_X + tag1_w, curr_y + 28],
        radius=7,
        fill=(19, 27, 46, 240),
        outline=(59, 130, 246, 110),
        width=1,
    )
    draw.text((PAD_X + 14, curr_y + 6), "ATTIO ENTERPRISE  •  SALES CRM", font=f_badge_tag, fill=(147, 197, 253))

    tag2_text = "● NỘI BỘ DOANH NGHIỆP"
    tb = draw.textbbox((0, 0), tag2_text, font=f_badge_tag)
    tag2_w = (tb[2] - tb[0]) + 26
    tag2_x = IMG_W - PAD_X - tag2_w
    draw.rounded_rectangle(
        [tag2_x, curr_y, tag2_x + tag2_w, curr_y + 28],
        radius=7,
        fill=(15, 30, 26, 230),
        outline=(16, 185, 129, 110),
        width=1,
    )
    draw.text((tag2_x + 13, curr_y + 6), tag2_text, font=f_badge_tag, fill=(52, 211, 153))

    curr_y += 28 + 14

    # Row 2: Title H1 Lớn Sắc Nét
    draw.text((PAD_X, curr_y), clean_title.upper(), font=f_h1, fill=(255, 255, 255))
    curr_y += 42 + 12

    # Row 3: NỔI BẬT NGƯỜI PHỤ TRÁCH "CHIẾN TRẦN" & METADATA
    assignee_name = assignee or "Chiến Trần"
    assignee_tag = f"Phụ trách: {assignee_name}"
    tb_as = draw.textbbox((0, 0), assignee_tag, font=f_meta_bold)
    as_w = (tb_as[2] - tb_as[0]) + 28
    as_h = 32

    # Pill phụ trách màu sáng nổi bật
    draw.rounded_rectangle(
        [PAD_X, curr_y, PAD_X + as_w, curr_y + as_h],
        radius=8,
        fill=(25, 39, 70, 245),
        outline=(96, 165, 250, 180),
        width=1,
    )
    draw.text((PAD_X + 14, curr_y + 7), assignee_tag, font=f_meta_bold, fill=(255, 255, 255))

    # Thông tin bổ trợ bên cạnh
    sub_info = subtitle or "Báo cáo kinh doanh nội bộ  •  Tự động chuẩn hóa"
    meta_x = PAD_X + as_w + 16
    draw.text((meta_x, curr_y + 8), sub_info, font=f_meta_reg, fill=(148, 163, 184))

    curr_y += as_h + 16

    # Đường kẻ phân cách Header
    draw.line([(PAD_X, curr_y), (IMG_W - PAD_X, curr_y)], fill=(32, 44, 68), width=1)
    curr_y += 18

    # --- VẼ CÁC CARDS MỤC (1 -> 5 & To-do) ---
    for c in computed_cards:
        num = c["num"]
        card_h = c["height"]
        palette = SECTION_PALETTES.get(num, SECTION_PALETTES["default"])

        # Khung thẻ sang trọng
        card_box = [PAD_X, curr_y, PAD_X + CARD_W, curr_y + card_h]
        draw.rounded_rectangle(card_box, radius=12, fill=(16, 21, 35, 245), outline=(32, 43, 65, 255), width=1)

        # Badge số thứ tự
        b_x = PAD_X + 16
        b_y = curr_y + 12
        b_size = 30
        draw.rounded_rectangle([b_x, b_y, b_x + b_size, b_y + b_size], radius=8, fill=palette["bg"], outline=palette["border"], width=1)

        # Số căn giữa badge
        nbox = draw.textbbox((0, 0), num, font=f_sec_num, stroke_width=1)
        nw, nh = nbox[2] - nbox[0], nbox[3] - nbox[1]
        draw.text((b_x + (b_size - nw) // 2, b_y + (b_size - nh) // 2 - 1), num, font=f_sec_num, fill=(255, 255, 255), stroke_width=1, stroke_fill=(255, 255, 255))

        # Tiêu đề mục
        title_x = b_x + b_size + 12
        draw.text((title_x, b_y + 4), c["title"], font=f_sec_title, fill=(248, 250, 252))

        # Chip số lượng bên phải
        if c["is_zero"]:
            chip_text = "0 phát sinh"
            chip_color = (100, 116, 139)
        else:
            cnt = c["item_count"]
            chip_text = f"{cnt} mục" if cnt > 1 else "1 mục"
            chip_color = (148, 163, 184)
        
        tb_cp = draw.textbbox((0, 0), chip_text, font=f_badge_tag)
        cp_w = (tb_cp[2] - tb_cp[0]) + 16
        cp_x = PAD_X + CARD_W - 16 - cp_w
        draw.rounded_rectangle([cp_x, b_y + 4, cp_x + cp_w, b_y + 26], radius=5, fill=(24, 32, 50, 200), outline=(40, 53, 78, 180), width=1)
        draw.text((cp_x + 8, b_y + 7), chip_text, font=f_badge_tag, fill=chip_color)

        # Đường gạch phân cách nhẹ giữa header thẻ và items
        div_y = b_y + b_size + 10
        draw.line([(PAD_X + 16, div_y), (PAD_X + CARD_W - 16, div_y)], fill=(26, 35, 52), width=1)

        # Nội dung items
        item_y = div_y + 10

        if c["is_zero"]:
            draw.text((PAD_X + 22, item_y), "•  Không có phát sinh trong kỳ (0)", font=f_body, fill=(100, 116, 139))
        else:
            for itm in c["items"]:
                is_hl = itm["is_hl"]
                fill_c = (56, 189, 248) if is_hl else (226, 232, 240)
                f_use = f_body_bold if is_hl else f_body

                for l_idx, line_str in enumerate(itm["lines"]):
                    if l_idx == 0:
                        bullet_char = "→" if is_hl else "•"
                        bullet_fill = (56, 189, 248) if is_hl else (148, 163, 184)
                        draw.text((PAD_X + 22, item_y), bullet_char, font=f_use, fill=bullet_fill)
                        draw.text((PAD_X + 40, item_y), line_str, font=f_use, fill=fill_c)
                    else:
                        draw.text((PAD_X + 40, item_y), line_str, font=f_use, fill=fill_c)

                    item_y += 26
                item_y += 6

        curr_y += card_h + CARD_SPACING

    # --- VẼ FOOTER ---
    curr_y += 6
    draw.line([(PAD_X, curr_y), (IMG_W - PAD_X, curr_y)], fill=(30, 41, 59), width=1)
    curr_y += 14

    footer_left = "ATTIO ENTERPRISE CRM  •  HỆ THỐNG QUẢN LÝ KINH DOANH"
    draw.text((PAD_X, curr_y), footer_left, font=f_footer, fill=(100, 116, 139))

    footer_right = f"PHỤ TRÁCH: {assignee_name.upper()}"
    tb_fr = draw.textbbox((0, 0), footer_right, font=f_footer_bold)
    fr_w = tb_fr[2] - tb_fr[0]
    draw.text((IMG_W - PAD_X - fr_w, curr_y), footer_right, font=f_footer_bold, fill=(148, 163, 184))

    # Chuyển đổi RGB và xuất base64
    out_rgb = img.convert("RGB")
    buf = io.BytesIO()
    out_rgb.save(buf, format="PNG", optimize=True)
    raw_bytes = buf.getvalue()
    b64_str = base64.b64encode(raw_bytes).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    return raw_bytes, data_url

# Alias tương thích ngược
render_report_to_image = render_report_image
