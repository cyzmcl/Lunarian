# main.py

import os
import io
from io import BytesIO
import traceback
import base64
import requests
import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Tuple
from collections import defaultdict


# 1. Environment variables for SAM checkpoint
SAM_CHECKPOINT_PATH = os.environ.get("SAM_CHECKPOINT_PATH", "/tmp/sam/sam_vit_b.pth")
SAM_CHECKPOINT_URL = os.environ.get(
    "SAM_CHECKPOINT_URL",
    "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
)
# If you prefer ViT-L or ViT-B, override SAM_CHECKPOINT_URL accordingly when deploying.
SAM_MODEL_TYPE = os.environ.get("SAM_MODEL_TYPE", "vit_b")

def ensure_sam_checkpoint():
    """
    Download the SAM checkpoint from SAM_CHECKPOINT_URL into SAM_CHECKPOINT_PATH
    if not already present. Runs once at container cold-start.
    """
    if os.path.exists(SAM_CHECKPOINT_PATH):
        print(f"SAM checkpoint already exists at {SAM_CHECKPOINT_PATH}", flush=True)
        return
    # Create directory if needed
    os.makedirs(os.path.dirname(SAM_CHECKPOINT_PATH), exist_ok=True)
    if not SAM_CHECKPOINT_URL:
        raise RuntimeError("SAM_CHECKPOINT_URL not set")
    print(f"Downloading SAM checkpoint from {SAM_CHECKPOINT_URL}", flush=True)
    try:
        resp = requests.get(SAM_CHECKPOINT_URL, stream=True, timeout=300)
        resp.raise_for_status()
        with open(SAM_CHECKPOINT_PATH, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        print("Downloaded SAM checkpoint successfully", flush=True)
    except Exception as e:
        print(f"Error downloading SAM checkpoint: {e}", flush=True)
        raise

# 2. Global init: download & load the SAM model once per container
try:
    ensure_sam_checkpoint()
except Exception as e:
    print(f"Failed to ensure SAM checkpoint: {e}", flush=True)
    raise

# Load SAM model
try:
    from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading SAM model type {SAM_MODEL_TYPE} from {SAM_CHECKPOINT_PATH}", flush=True)
    sam = sam_model_registry[SAM_MODEL_TYPE](checkpoint=SAM_CHECKPOINT_PATH)
    sam.to(device)
    predictor = SamPredictor(sam)
    print("✅ SAM model loaded", flush=True)
except Exception as e:
    print(f"Error loading SAM model: {e}", flush=True)
    predictor = None


# 3. Helper functions: paste your existing code here
backend_dir = os.path.dirname(__file__)
FONT_DIR = os.path.join(backend_dir, "fonts")
DEFAULT_FONT_PATH = os.path.join(FONT_DIR, "arial.ttf")
FONT_MAP = {
    "arial.ttf": os.path.join(FONT_DIR, "arial.ttf"),
    "helvetica.ttf": os.path.join(FONT_DIR, "helvetica.ttf"),
    "verdana.ttf": os.path.join(FONT_DIR, "verdana.ttf"),
    "georgia.ttf": os.path.join(FONT_DIR, "georgia.ttf"),
    "times.ttf": os.path.join(FONT_DIR, "times.ttf"),
    "cour.ttf": os.path.join(FONT_DIR, "cour.ttf"),
    "Inter-Regular.ttf": os.path.join(FONT_DIR, "Inter-Regular.ttf"),
    "Roboto-Regular.ttf": os.path.join(FONT_DIR, "Roboto-Regular.ttf"),
    "OpenSans-Regular.ttf": os.path.join(FONT_DIR, "OpenSans-Regular.ttf"),
    "Lato-Regular.ttf": os.path.join(FONT_DIR, "Lato-Regular.ttf"),
    "Montserrat-Regular.ttf": os.path.join(FONT_DIR, "Montserrat-Regular.ttf"),
    "Poppins-Regular.ttf": os.path.join(FONT_DIR, "Poppins-Regular.ttf"),
    "Nunito-Regular.ttf": os.path.join(FONT_DIR, "Nunito-Regular.ttf"),
}

def get_font_path(font_filename: Optional[str]) -> str:
    """Safely get a valid font path from a filename, with fallback."""
    if not font_filename:
        return DEFAULT_FONT_PATH
    
    path = FONT_MAP.get(font_filename, DEFAULT_FONT_PATH)
    if not os.path.exists(path):
        print(f"Warning: Font file '{font_filename}' mapped to '{path}' but not found. Falling back to default.")
        return DEFAULT_FONT_PATH
    return path

def decode_data_url(data_url: str) -> Image.Image:
    if not data_url: raise HTTPException(400, "Missing image data")
    header, encoded = data_url.split(",",1) if "," in data_url else ("",data_url)
    try: 
        return Image.open(BytesIO(base64.b64decode(encoded))).convert("RGBA")
    except Exception as e: 
        print(f"Error decoding image: {e}")
        raise HTTPException(400, "Invalid image data")

def encode_image_to_data_url(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def get_hero_bbox_from_input_or_sam(img: Image.Image, user_bbox_xywh: Optional[Dict[str, int]]=None) -> Optional[Tuple[int,int,int,int]]:
    ow, oh = img.size
    img_np = np.array(img.convert("RGB"))

    if user_bbox_xywh and predictor:
        x0,y0,w,h = user_bbox_xywh["x"],user_bbox_xywh["y"],user_bbox_xywh["width"],user_bbox_xywh["height"]
        x1,y1 = max(0, x0), max(0, y0)
        x2,y2 = min(ow, x0 + w), min(oh, y0 + h)
        if x1 >= x2 or y1 >= y2:
            print("User BBox invalid, trying SAM auto if available.")
        else:
            try:
                predictor.set_image(img_np)
                masks, scores, _ = predictor.predict(box=np.array([[x1,y1,x2,y2]]), multimask_output=True)
                best_mask_idx = np.argmax(scores)
                best_mask = masks[best_mask_idx]
                ys, xs = np.nonzero(best_mask)
                if xs.size and ys.size: 
                    print(f"SAM derived bbox from user input: {(int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))}")
                    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
            except Exception as e:
                print(f"Error during SAM prediction with user box: {e}")

    if predictor and SamAutomaticMaskGenerator:
        try:
            auto_mask_generator = SamAutomaticMaskGenerator(predictor.model)
            print("Running SAM Automatic Mask Generator...")
            sam_results = auto_mask_generator.generate(img_np)
            if sam_results:
                best_mask_info = max(sam_results, key=lambda m: m['area'])
                x,y,w,h = best_mask_info['bbox']
                print(f"SAM auto-detected hero bbox (xywh): {(x,y,w,h)}")
                return (x, y, x + w, y + h)
            else:
                print("SAM auto-generator found no masks.")
        except Exception as e:
            print(f"Error during SAM automatic mask generation: {e}")
    
    print("No hero bbox determined by SAM or user input.")
    return None

def create_base_canvas_with_hero(
    src: Image.Image,
    tw: int,
    th: int,
    hero_bbox: Optional[Tuple[int, int, int, int]],
    hero_area_x: int, # Available area for hero placement
    hero_area_y: int,
    hero_area_w: int,
    hero_area_h: int,
    hero_prominence: float = 0.7, # Target prominence of hero within its available area
    bg_color=(255, 255, 255, 0) 
) -> Image.Image:
    iw, ih = src.size
    canvas = Image.new("RGBA", (tw, th), bg_color)
    if iw == 0 or ih == 0: return canvas

    if not hero_bbox or hero_area_w <=0 or hero_area_h <=0 :
        scale = max(tw / iw if iw > 0 else 1, th / ih if ih > 0 else 1)
        rw, rh = int(iw * scale), int(ih * scale)
        img2 = src.resize((rw, rh), Image.LANCZOS)
        cx, cy = (rw - tw) // 2, (rh - th) // 2
        canvas.paste(img2.crop((max(0, cx), max(0, cy), min(rw, cx + tw), min(rh, cy + th))), (0, 0))
        return canvas

    x1, y1, x2, y2 = hero_bbox
    h_w, h_h = x2 - x1, y2 - y1
    hcx, hcy = x1 + h_w / 2, y1 + h_h / 2

    if h_w <= 0 or h_h <= 0:
        return create_base_canvas_with_hero(src, tw, th, None, hero_area_x, hero_area_y, hero_area_w, hero_area_h, bg_color=bg_color)

    scale_needed_for_hero_w = (hero_area_w * hero_prominence) / h_w if h_w > 0 else float("inf")
    scale_needed_for_hero_h = (hero_area_h * hero_prominence) / h_h if h_h > 0 else float("inf")
    scale_for_hero = min(scale_needed_for_hero_w, scale_needed_for_hero_h)

    scale_to_cover_canvas = max(tw / iw if iw > 0 else 1, th / ih if ih > 0 else 1)
    
    final_scale = max(scale_for_hero, scale_to_cover_canvas)
    
    scaled_iw, scaled_ih = int(iw * final_scale), int(ih * final_scale)
    scaled_iw, scaled_ih = max(tw, scaled_iw), max(th, scaled_ih) 
    img_resized = src.resize((scaled_iw, scaled_ih), Image.LANCZOS)

    scaled_hero_cx, scaled_hero_cy = hcx * final_scale, hcy * final_scale
    
    target_hero_center_x_in_canvas = hero_area_x + hero_area_w / 2
    target_hero_center_y_in_canvas = hero_area_y + hero_area_h / 2
    
    crop_x = scaled_hero_cx - target_hero_center_x_in_canvas
    crop_y = scaled_hero_cy - target_hero_center_y_in_canvas

    crop_x = max(0, min(crop_x, scaled_iw - tw))
    crop_y = max(0, min(crop_y, scaled_ih - th))

    final_img_to_paste = img_resized.crop((int(crop_x), int(crop_y), int(crop_x + tw), int(crop_y + th)))
    canvas.paste(final_img_to_paste, (0, 0))
    return canvas

def get_element_position(pos_key: str, el_w: int, el_h: int, zone_x: int, zone_y: int, zone_w: int, zone_h: int) -> Tuple[int, int]:
    px, py = zone_x, zone_y 

    if "left" in pos_key: px = zone_x
    elif "right" in pos_key: px = zone_x + zone_w - el_w
    elif "center" in pos_key: px = zone_x + (zone_w - el_w) // 2
    
    if "top" in pos_key: py = zone_y
    elif "bottom" in pos_key: py = zone_y + zone_h - el_h
    elif "middle" in pos_key: py = zone_y + (zone_h - el_h) // 2
    
    return int(px), int(py)

def find_font_size_for_height(target_height: int, current_font_path: str, min_size: int = 10, max_size: int = 128, sample_text: str = "Aj") -> int:
    # This function now relies entirely on the passed `current_font_path`
    best_size = min_size
    best_diff = float('inf')
    
    target_height = max(1, target_height)
    
    low, high = min_size, max_size
    while low <= high:
        mid = (low + high) // 2
        if mid <= 0:
            low = 1
            continue
        try:
            # Safely load the font, falling back to PIL's default if the path is bad
            fnt = ImageFont.truetype(current_font_path, mid)
        except (IOError, TypeError):
            fnt = ImageFont.load_default()
        
        try:
            bbox = fnt.getbbox(sample_text)
            h = bbox[3] - bbox[1] if bbox else mid 
        except Exception:
            h = mid 
        
        diff = abs(h - target_height)
        if diff < best_diff:
            best_diff = diff
            best_size = mid
        
        if h < target_height:
            low = mid + 1
        elif h > target_height:
            high = mid - 1
        else:
            return mid
            
    return best_size

def get_edges_for_pos_key(pos_key: str) -> set:
    edges = set()
    if "top" in pos_key: edges.add("top")
    if "bottom" in pos_key: edges.add("bottom")
    if "left" in pos_key: edges.add("left")
    if "right" in pos_key: edges.add("right")
    if pos_key in ("top_center", "bottom_center"): edges.add("top" if "top" in pos_key else "bottom")
    if pos_key in ("left_middle", "right_middle"): edges.add("left" if "left" in pos_key else "right")
    return edges
# Paste any other helpers from your original app.py, e.g.:
# - create_base_canvas_with_hero
# - place_logo_on_canvas
# - place_copy_on_canvas
# - place_cta_on_canvas
# - run_full_inference that returns Dict[str, PIL.Image]
# - encode_image_to_data_url to convert PIL.Image to base64 string


# 4. Pydantic models
class FormatItem(BaseModel):
    id: str
    width: int
    height: int

class GenerateRequest(BaseModel):
    sourceImage: str
    userInputHeroBbox: Optional[Dict[str,int]] = None
    
    # --- Logo ---
    brandLogo: Optional[str] = None
    includeLogo: bool = False
    logoAppliesToAll: bool = True
    logoSelectedFormats: List[str] = []
    logoPositionByOrientation: Dict[str, str] = {}
    # --- Ad Copy ---
    includeCopy: bool = False
    adCopy: Optional[str] = None
    # This is now a font filename from the frontend, e.g., "Inter-Regular.ttf"
    copyFontFamily: Optional[str] = "arial.ttf"
    copyAppliesToAll: bool = True
    copySelectedFormats: List[str] = []
    copyPositionByOrientation: Dict[str, str] = {}
    copyBrandColor: str = "#000000"
    # --- CTA ---
    includeCta: bool = False
    ctaText: Optional[str] = None
    ctaAppliesToAll: bool = True
    ctaSelectedFormats: List[str] = []
    ctaPositionByOrientation: Dict[str, str] = {}
    # This is also a font filename
    ctaFont: Optional[str] = "arial.ttf" 
    ctaTextColor: Optional[str] = "#FFFFFF"
    ctaBgColor: Optional[str] = "#000000"

    formats: List[FormatItem]

class GenerateResponse(BaseModel):
    results: Dict[str,str]

# 5. FastAPI app and endpoint
app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/generate", response_model=GenerateResponse)
async def generate_ads(req: GenerateRequest):
    try:
        src_pil = decode_data_url(req.sourceImage)
        logo_pil_img = decode_data_url(req.brandLogo) if req.brandLogo and req.includeLogo else None 
        hero_bbox = get_hero_bbox_from_input_or_sam(src_pil.copy(), req.userInputHeroBbox) 
        
        # --- MODIFICATION: Get font paths from request using the new helper ---
        copy_font_path = get_font_path(req.copyFontFamily)
        cta_font_path = get_font_path(req.ctaFont)
        
        print(f"Using Copy Font: {copy_font_path}")
        print(f"Using CTA Font: {cta_font_path}")
        output_results: Dict[str,str] = {}

        for fmt_item in req.formats:
            fid, tw, th = fmt_item.id, fmt_item.width, fmt_item.height

            if tw == th: orientation = "square"
            elif th > tw: orientation = "portrait"
            else: orientation = "landscape"

            if (tw, th) == (1440, 2560): 
                sx, sy, sw, sh = map(int, (127.34, 254.56, 1182.1, 2072.43))
            else: 
                margin_pct = 0.07
                margin_x = int(tw * margin_pct)
                margin_y = int(th * margin_pct)
                sx, sy = margin_x, margin_y
                sw, sh = tw - 2 * margin_x, th - 2 * margin_y
            safe_w, safe_h = sw, sh

            show_logo_for_format = req.includeLogo and logo_pil_img and (req.logoAppliesToAll or fid in req.logoSelectedFormats)
            show_copy_for_format = req.includeCopy and req.adCopy and (req.copyAppliesToAll or fid in req.copySelectedFormats)
            show_cta_for_format  = req.includeCta  and req.ctaText and (req.ctaAppliesToAll  or fid in req.ctaSelectedFormats)

            logo_pos_key = req.logoPositionByOrientation.get(orientation, "top_center")
            copy_pos_key = req.copyPositionByOrientation.get(orientation, "bottom_center")
            if copy_pos_key == "let_ai_choose": copy_pos_key = "bottom_center" 
            cta_pos_key = req.ctaPositionByOrientation.get(orientation, "bottom_center")
            if cta_pos_key == "let_ai_choose": cta_pos_key = "bottom_center"

            format_level_logo_short_side_ref = int(((safe_h * safe_w) * 0.02) ** 0.5) 
            if show_logo_for_format and logo_pil_img:
                is_square_fmt_g = (tw == th)
                is_special_fmt_g = (tw, th) in [(300, 250), (336, 280)]
                is_portrait_fmt_g = th > tw

                if is_square_fmt_g or is_special_fmt_g: pct_g = 0.0215
                elif is_portrait_fmt_g: pct_g = 0.02 
                else: pct_g = 0.035 
                
                logo_area_g = (safe_w * safe_h) * pct_g
                orig_w_g, orig_h_g = logo_pil_img.size
                aspect_g = orig_w_g / orig_h_g if orig_h_g > 0 else 1
                logo_h_g_calc = int((logo_area_g / aspect_g) ** 0.5) if aspect_g > 0 else 0
                logo_w_g_calc = int(logo_h_g_calc * aspect_g)
                
                logo_w_g_calc = min(logo_w_g_calc, safe_w)
                logo_h_g_calc = min(logo_h_g_calc, safe_h)
                
                if logo_w_g_calc > 0 and logo_h_g_calc > 0:
                    format_level_logo_short_side_ref = min(logo_w_g_calc, logo_h_g_calc)

            elements_for_prepass = []
            if show_logo_for_format: elements_for_prepass.append(("logo", logo_pos_key, logo_pil_img))
            if show_copy_for_format: elements_for_prepass.append(("copy", copy_pos_key, req.adCopy))
            if show_cta_for_format:  elements_for_prepass.append(("cta",  cta_pos_key,  req.ctaText))

            pos_groups_prepass = defaultdict(list)
            for name, pos_key_item, content in elements_for_prepass:
                pos_groups_prepass[pos_key_item].append((name, content))
            
            edge_blocks = {"top": [], "bottom": [], "left": [], "right": []}
            pre_pass_element_spacing = max(3, int(min(safe_w, safe_h) * 0.02))

            for pos_key_item, group_content in pos_groups_prepass.items():
                current_group_total_h = 0
                current_group_max_w = 0
                
                logo_w_pre, logo_h_pre = 0, 0
                for name, content_item in group_content:
                    if name == "logo": 
                        is_square_fmt = (tw == th)
                        is_special_fmt = (tw, th) in [(300, 250), (336, 280)]
                        is_portrait_fmt = th > tw
                        
                        if is_square_fmt or is_special_fmt: pct = 0.0215
                        elif is_portrait_fmt: pct = 0.02
                        else: pct = 0.035 

                        logo_area = (safe_w * safe_h) * pct
                        orig_w, orig_h = content_item.size
                        aspect = orig_w / orig_h if orig_h > 0 else 1
                        logo_h_pre = int((logo_area / aspect) ** 0.5) if aspect > 0 else 0
                        logo_w_pre = int(logo_h_pre * aspect)
                        logo_w_pre = min(logo_w_pre, safe_w)
                        logo_h_pre = min(logo_h_pre, safe_h)
                        break 

                num_elements_in_group = len(group_content)
                for idx, (name, content_item) in enumerate(group_content):
                    el_w, el_h = 0, 0
                    if name == "logo":
                        el_w, el_h = logo_w_pre, logo_h_pre 
                    elif name == "copy":
                        buffer = 4
                        if "left" in pos_key_item or "right" in pos_key_item:
                            max_ac_w = int(safe_w * 0.40)
                        else:
                            max_ac_w = int(safe_w * 0.80)
                        max_ac_w = min(max_ac_w, safe_w - buffer)
                        max_ac_w = max(int(safe_w * 0.30), max_ac_w)
                        
                        lss_ref = format_level_logo_short_side_ref 
                        ac_target_h = int(lss_ref * 1.25)
                        # Use copy_font_path
                        ac_font_sz = find_font_size_for_height(ac_target_h, copy_font_path)
                        ac_fnt = ImageFont.truetype(copy_font_path, ac_font_sz)
                        ac_line_h_approx = (ac_fnt.getbbox("Aj")[3] - ac_fnt.getbbox("Aj")[1]) if ac_fnt.getbbox("Aj") else ac_font_sz
                        
                        ad_copy_lines = []
                        curr_l, words = "", content_item.split()
                        for word in words:
                            test_l = curr_l + (" " if curr_l else "") + word
                            lw = ac_fnt.getbbox(test_l)[2] - ac_fnt.getbbox(test_l)[0] if ac_fnt.getbbox(test_l) else len(test_l) * ac_font_sz * 0.6 
                            if lw <= max_ac_w: curr_l = test_l
                            else:
                                if curr_l: ad_copy_lines.append(curr_l)
                                curr_l = word
                        if curr_l: ad_copy_lines.append(curr_l)
                        if not ad_copy_lines and content_item: ad_copy_lines.append(content_item[:int(max_ac_w/(ac_font_sz*0.6))])
                        
                        def all_lines_fit_prepass(lines, font, target_w):
                            for line in lines:
                                line_bbox = font.getbbox(line)
                                lw = line_bbox[2] - line_bbox[0] if line_bbox else 0
                                if lw > target_w:
                                    return False
                            return True

                        temp_ad_copy_lines = list(ad_copy_lines)
                        current_ac_font_sz = ac_font_sz
                        current_ac_fnt = ac_fnt

                        while current_ac_font_sz > 10:
                            if current_ac_font_sz != ac_font_sz or temp_ad_copy_lines is None :
                                temp_ad_copy_lines = []
                                curr_l_temp, words_temp = "", content_item.split()
                                for word_temp in words_temp:
                                    test_l_temp = curr_l_temp + (" " if curr_l_temp else "") + word_temp
                                    lw_temp = current_ac_fnt.getbbox(test_l_temp)[2] - current_ac_fnt.getbbox(test_l_temp)[0] if current_ac_fnt.getbbox(test_l_temp) else len(test_l_temp) * current_ac_font_sz * 0.6
                                    if lw_temp <= max_ac_w: curr_l_temp = test_l_temp
                                    else:
                                        if curr_l_temp: temp_ad_copy_lines.append(curr_l_temp)
                                        curr_l_temp = word_temp
                                if curr_l_temp: temp_ad_copy_lines.append(curr_l_temp)
                                if not temp_ad_copy_lines and content_item: temp_ad_copy_lines.append(content_item[:int(max_ac_w/(current_ac_font_sz*0.6))])

                            if all_lines_fit_prepass(temp_ad_copy_lines, current_ac_fnt, max_ac_w):
                                ad_copy_lines = temp_ad_copy_lines
                                ac_font_sz = current_ac_font_sz
                                ac_fnt = current_ac_fnt
                                ac_line_h_approx = (ac_fnt.getbbox("Aj")[3] - ac_fnt.getbbox("Aj")[1]) if ac_fnt.getbbox("Aj") else ac_font_sz
                                break 
                            current_ac_font_sz -= 1
                            current_ac_fnt = ImageFont.truetype(copy_font_path, current_ac_font_sz)
                        else:
                            ad_copy_lines = temp_ad_copy_lines
                            ac_font_sz = current_ac_font_sz
                            ac_fnt = current_ac_fnt
                            ac_line_h_approx = (ac_fnt.getbbox("Aj")[3] - ac_fnt.getbbox("Aj")[1]) if ac_fnt.getbbox("Aj") else ac_font_sz

                        ac_line_sp = int(ac_line_h_approx * 0.2)
                        el_h = len(ad_copy_lines) * (ac_line_h_approx + ac_line_sp) - (ac_line_sp if ac_line_sp > 0 and len(ad_copy_lines)>0 else 0)
                        el_h = max(0, el_h) 

                        el_w = 0
                        for line in ad_copy_lines:
                            lw = ac_fnt.getbbox(line)[2] - ac_fnt.getbbox(line)[0] if ac_fnt.getbbox(line) else 0
                            el_w = max(el_w, lw)
                        el_w = min(el_w, safe_w)

                    elif name == "cta":
                        lss_ref = format_level_logo_short_side_ref 
                        el_h = lss_ref 
                        cta_fnt_sz = max(10, min(int(el_h * 0.6), 80))
                        # Use cta_font_path
                        cta_fnt = ImageFont.truetype(cta_font_path, cta_fnt_sz)
                        cta_txt_bbox = cta_fnt.getbbox(content_item.upper())
                        cta_txt_w = cta_txt_bbox[2] - cta_txt_bbox[0] if cta_txt_bbox else 0
                        cta_pad_x = int(cta_fnt_sz * 1)
                        el_w = cta_txt_w + 2 * cta_pad_x
                        el_w = min(el_w, safe_w) 
                    
                    current_group_max_w = max(current_group_max_w, el_w)
                    current_group_total_h += el_h
                    if idx < num_elements_in_group - 1:
                        current_group_total_h += pre_pass_element_spacing
                
                occupied_edges = get_edges_for_pos_key(pos_key_item)
                for edge in occupied_edges:
                    if edge in ["top", "bottom"]: 
                        edge_blocks[edge].append((current_group_max_w, current_group_total_h))
                    elif edge in ["left", "right"]: 
                        edge_blocks[edge].append((current_group_max_w, current_group_total_h))

            occupied_top = sum(h for _, h in edge_blocks["top"]) + (pre_pass_element_spacing if edge_blocks["top"] else 0)
            occupied_bottom = sum(h for _, h in edge_blocks["bottom"]) + (pre_pass_element_spacing if edge_blocks["bottom"] else 0)
            occupied_left = sum(w for w, _ in edge_blocks["left"]) + (pre_pass_element_spacing if edge_blocks["left"] else 0)
            occupied_right = sum(w for w, _ in edge_blocks["right"]) + (pre_pass_element_spacing if edge_blocks["right"] else 0)
            
            hero_area_x = sx + occupied_left
            hero_area_y = sy + occupied_top
            hero_area_w = max(1, sw - occupied_left - occupied_right)
            hero_area_h = max(1, sh - occupied_top - occupied_bottom)

            canvas = create_base_canvas_with_hero(
                src_pil, tw, th, hero_bbox,
                hero_area_x, hero_area_y, hero_area_w, hero_area_h
            )
            draw = ImageDraw.Draw(canvas)
            
            elements_for_drawing = []
            if show_logo_for_format: elements_for_drawing.append(("logo", logo_pos_key, logo_pil_img))
            if show_copy_for_format: elements_for_drawing.append(("copy", copy_pos_key, req.adCopy))
            if show_cta_for_format:  elements_for_drawing.append(("cta",  cta_pos_key,  req.ctaText))

            pos_groups_drawing = defaultdict(list)
            for name, pos_key_item, content in elements_for_drawing:
                pos_groups_drawing[pos_key_item].append((name, content))

            for pos_key_item, group_content in pos_groups_drawing.items():
                stacking_order = []
                content_by_name = {name: content for name, content in group_content}

                if pos_key_item == "bottom_center" and len(group_content) == 2:
                    names = list(content_by_name.keys())
                    has_copy = "copy" in names
                    has_cta = "cta" in names
                    has_logo = "logo" in names
                    if has_copy:
                        stacking_order.append("copy")
                        if has_cta: stacking_order.append("cta")
                        elif has_logo: stacking_order.append("logo")
                    elif has_cta: 
                        stacking_order.append("cta")
                        if has_logo: stacking_order.append("logo")
                    elif has_logo: 
                         stacking_order.append("logo")
                else: 
                    if "logo" in content_by_name: stacking_order.append("logo")
                    if "copy" in content_by_name: stacking_order.append("copy")
                    if "cta" in content_by_name: stacking_order.append("cta")
                
                is_square_fmt = (tw == th)
                is_special_fmt = (tw, th) in [(300, 250), (336, 280)]
                is_portrait_fmt = th > tw

                if is_portrait_fmt:
                    logo_spacing = max(3, int(safe_h * 0.05))
                    copy_cta_spacing = max(3, int(safe_h * 0.02))
                elif is_square_fmt or is_special_fmt:
                    logo_spacing = max(3, int(safe_h * 0.06))
                    copy_cta_spacing = max(3, int(safe_h * 0.03))
                else:  # landscape
                    logo_spacing = max(3, int(safe_h * 0.06))
                    copy_cta_spacing = max(3, int(safe_h * 0.05))
                general_element_spacing = max(3, int(min(safe_w, safe_h) * 0.02))
                
                el_render_details = [] 
                
                logo_w_final_local, logo_h_final_local = 0,0
                for name, content_item in group_content:
                    if name == "logo":
                        if is_square_fmt or is_special_fmt: pct = 0.0215
                        elif is_portrait_fmt: pct = 0.02
                        else: pct = 0.035
                        
                        logo_area = (safe_w * safe_h) * pct 
                        orig_w, orig_h = content_item.size
                        aspect = orig_w / orig_h if orig_h > 0 else 1
                        logo_h_final_local = int((logo_area / aspect) ** 0.5) if aspect > 0 else 0
                        logo_w_final_local = int(logo_h_final_local * aspect)
                        logo_w_final_local = min(logo_w_final_local, safe_w) 
                        logo_h_final_local = min(logo_h_final_local, safe_h)
                        el_render_details.append({"name": "logo", "width": logo_w_final_local, "height": logo_h_final_local, "content": content_item})
                        break
                
                for name, content_item in group_content:
                    if name == "logo" and any(d["name"] == "logo" for d in el_render_details): continue 

                    if name == "copy":
                        buffer_final = 4
                        if "left" in pos_key_item or "right" in pos_key_item:
                            max_ac_w_final = int(safe_w * 0.40)
                        else:
                            max_ac_w_final = int(safe_w * 0.80)
                        max_ac_w_final = min(max_ac_w_final, safe_w - buffer_final)
                        max_ac_w_final = max(int(safe_w * 0.30), max_ac_w_final)

                        lss_ref = format_level_logo_short_side_ref 
                        ac_target_h_final = int(lss_ref * 1.25)
                        # Use copy_font_path
                        ac_font_sz_final = find_font_size_for_height(ac_target_h_final, copy_font_path)
                        ac_fnt_final = ImageFont.truetype(copy_font_path, ac_font_sz_final)
                        ac_line_h_approx_final = (ac_fnt_final.getbbox("Aj")[3] - ac_fnt_final.getbbox("Aj")[1]) if ac_fnt_final.getbbox("Aj") else ac_font_sz_final
                        
                        ad_copy_lines_final = []
                        curr_l, words = "", content_item.split()
                        for word in words:
                            test_l = curr_l + (" " if curr_l else "") + word
                            lw = ac_fnt_final.getbbox(test_l)[2] - ac_fnt_final.getbbox(test_l)[0] if ac_fnt_final.getbbox(test_l) else len(test_l) * ac_font_sz_final * 0.6
                            if lw <= max_ac_w_final: curr_l = test_l
                            else:
                                if curr_l: ad_copy_lines_final.append(curr_l)
                                curr_l = word
                        if curr_l: ad_copy_lines_final.append(curr_l)
                        if not ad_copy_lines_final and content_item: ad_copy_lines_final.append(content_item[:int(max_ac_w_final/(ac_font_sz_final*0.6))])

                        def all_lines_fit_final(lines, font, target_w):
                            for line in lines:
                                line_bbox = font.getbbox(line)
                                lw = line_bbox[2] - line_bbox[0] if line_bbox else 0
                                if lw > target_w:
                                    return False
                            return True
                        
                        temp_ad_copy_lines_final = list(ad_copy_lines_final)
                        current_ac_font_sz_final = ac_font_sz_final
                        current_ac_fnt_final = ac_fnt_final

                        while current_ac_font_sz_final > 10:
                            if current_ac_font_sz_final != ac_font_sz_final or temp_ad_copy_lines_final is None:
                                temp_ad_copy_lines_final = []
                                curr_l_temp, words_temp = "", content_item.split()
                                for word_temp in words_temp:
                                    test_l_temp = curr_l_temp + (" " if curr_l_temp else "") + word_temp
                                    lw_temp = current_ac_fnt_final.getbbox(test_l_temp)[2] - current_ac_fnt_final.getbbox(test_l_temp)[0] if current_ac_fnt_final.getbbox(test_l_temp) else len(test_l_temp) * current_ac_font_sz_final * 0.6
                                    if lw_temp <= max_ac_w_final: curr_l_temp = test_l_temp
                                    else:
                                        if curr_l_temp: temp_ad_copy_lines_final.append(curr_l_temp)
                                        curr_l_temp = word_temp
                                if curr_l_temp: temp_ad_copy_lines_final.append(curr_l_temp)
                                if not temp_ad_copy_lines_final and content_item: temp_ad_copy_lines_final.append(content_item[:int(max_ac_w_final/(current_ac_font_sz_final*0.6))])

                            if all_lines_fit_final(temp_ad_copy_lines_final, current_ac_fnt_final, max_ac_w_final):
                                ad_copy_lines_final = temp_ad_copy_lines_final
                                ac_font_sz_final = current_ac_font_sz_final
                                ac_fnt_final = current_ac_fnt_final
                                ac_line_h_approx_final = (ac_fnt_final.getbbox("Aj")[3] - ac_fnt_final.getbbox("Aj")[1]) if ac_fnt_final.getbbox("Aj") else ac_font_sz_final
                                break
                            current_ac_font_sz_final -=1
                            current_ac_fnt_final = ImageFont.truetype(copy_font_path, current_ac_font_sz_final)
                        else:
                            ad_copy_lines_final = temp_ad_copy_lines_final
                            ac_font_sz_final = current_ac_font_sz_final
                            ac_fnt_final = current_ac_fnt_final
                            ac_line_h_approx_final = (ac_fnt_final.getbbox("Aj")[3] - ac_fnt_final.getbbox("Aj")[1]) if ac_fnt_final.getbbox("Aj") else ac_font_sz_final

                        ac_line_sp_final = int(ac_line_h_approx_final * 0.2)
                        ac_block_h_final = len(ad_copy_lines_final) * (ac_line_h_approx_final + ac_line_sp_final) - (ac_line_sp_final if ac_line_sp_final > 0 and len(ad_copy_lines_final)>0 else 0)
                        ac_block_h_final = max(0, ac_block_h_final)
                        
                        ac_block_w_final = 0
                        for line in ad_copy_lines_final:
                            lw = ac_fnt_final.getbbox(line)[2] - ac_fnt_final.getbbox(line)[0] if ac_fnt_final.getbbox(line) else 0
                            ac_block_w_final = max(ac_block_w_final, lw)
                        ac_block_w_final = min(ac_block_w_final, safe_w)
                        
                        el_render_details.append({
                            "name": "copy", "width": ac_block_w_final, "height": ac_block_h_final, 
                            "lines": ad_copy_lines_final, "line_spacing": ac_line_sp_final, 
                            "font": ac_fnt_final, "line_height_approx": ac_line_h_approx_final, "content": content_item
                        })

                    elif name == "cta":
                        lss_ref = format_level_logo_short_side_ref 
                        cta_h_final = lss_ref
                        cta_fnt_sz_final = max(10, min(int(cta_h_final * 0.6), 80))
                        
                        # Use cta_font_path
                        cta_fnt_final = ImageFont.truetype(cta_font_path, cta_fnt_sz_final)
                        
                        cta_txt_bbox_final = cta_fnt_final.getbbox(content_item.upper())
                        cta_txt_w_final = cta_txt_bbox_final[2] - cta_txt_bbox_final[0] if cta_txt_bbox_final else 0
                        cta_txt_h_approx_final = cta_txt_bbox_final[3] - cta_txt_bbox_final[1] if cta_txt_bbox_final else cta_fnt_sz_final
                        
                        cta_text_offset_y = ((cta_h_final - cta_txt_h_approx_final) // 2) - (cta_txt_bbox_final[1] if cta_txt_bbox_final else 0)
                        cta_pad_x_final = int(cta_fnt_sz_final * 1)
                        cta_w_final = cta_txt_w_final + 2 * cta_pad_x_final
                        cta_w_final = min(cta_w_final, safe_w) 
                        cta_text_offset_x = cta_pad_x_final 

                        el_render_details.append({
                            "name": "cta", "width": cta_w_final, "height": cta_h_final, 
                            "font": cta_fnt_final, "text_offset_x": cta_text_offset_x, "text_offset_y": cta_text_offset_y,
                            "content": content_item.upper()
                        })
                
                el_render_details_sorted = sorted(
                    el_render_details, 
                    key=lambda x: stacking_order.index(x["name"]) if x["name"] in stacking_order else 99
                )

                stacked_block_total_h = 0
                stacked_block_max_w = 0
                for i, el_detail in enumerate(el_render_details_sorted):
                    stacked_block_total_h += el_detail["height"]
                    stacked_block_max_w = max(stacked_block_max_w, el_detail["width"])
                    if i < len(el_render_details_sorted) - 1:
                        curr_type = el_detail["name"]
                        next_type = el_render_details_sorted[i+1]["name"]
                        if (curr_type == "logo" and next_type in ("copy", "cta")) or \
                           (next_type == "logo" and curr_type in ("copy", "cta")):
                            stacked_block_total_h += logo_spacing
                        elif (curr_type == "copy" and next_type == "cta") or \
                             (curr_type == "cta" and next_type == "copy"):
                            stacked_block_total_h += copy_cta_spacing
                        else: 
                            stacked_block_total_h += general_element_spacing
                
                gx, gy = get_element_position(
                    pos_key_item, stacked_block_max_w, stacked_block_total_h, 
                    sx, sy, safe_w, safe_h 
                )

                current_y_offset = gy
                for i, el_detail in enumerate(el_render_details_sorted):
                    el_name = el_detail["name"]
                    el_w = el_detail["width"] 
                    el_h = el_detail["height"]
                    
                    px = gx + (stacked_block_max_w - el_w) // 2

                    if el_name == "logo":
                        logo_resized = el_detail["content"].resize((el_w, el_h), Image.LANCZOS)
                        canvas.paste(logo_resized, (px, current_y_offset), logo_resized)
                    
                    elif el_name == "copy":
                        text_block_x = px 
                        for line_idx, line_text in enumerate(el_detail["lines"]):
                            line_bbox = el_detail["font"].getbbox(line_text)
                            actual_line_w = line_bbox[2] - line_bbox[0] if line_bbox else 0
                            
                            draw_line_x = text_block_x 
                            if actual_line_w < el_w: 
                                draw_line_x = text_block_x + (el_w - actual_line_w) // 2
                            
                            draw.text(
                                (draw_line_x, current_y_offset + line_idx * (el_detail["line_height_approx"] + el_detail["line_spacing"])),
                                line_text, fill=req.copyBrandColor, font=el_detail["font"]
                            )
                    
                    elif el_name == "cta":
                        draw.rectangle(
                            [(px, current_y_offset), (px + el_w, current_y_offset + el_h)],
                                fill=req.ctaBgColor 
                        )
                            
                        draw.text(
                                (px + el_detail["text_offset_x"], current_y_offset + el_detail["text_offset_y"]),
                                el_detail["content"], 
                                fill=req.ctaTextColor, 
                                font=el_detail["font"]
                        )

                    current_y_offset += el_h
                    if i < len(el_render_details_sorted) - 1:
                        curr_type = el_detail["name"]
                        next_type = el_render_details_sorted[i+1]["name"]
                        if (curr_type == "logo" and next_type in ("copy", "cta")) or \
                           (next_type == "logo" and curr_type in ("copy", "cta")):
                            current_y_offset += logo_spacing
                        elif (curr_type == "copy" and next_type == "cta") or \
                             (curr_type == "cta" and next_type == "copy"):
                            current_y_offset += copy_cta_spacing
                        else:
                            current_y_offset += general_element_spacing
            
            output_results[fid] = encode_image_to_data_url(canvas)
        return {"results": output_results}

    except HTTPException: 
        raise
    except Exception as e: 
        print(f"Error in /generate: {e}"); traceback.print_exc()
        raise HTTPException(500,detail=f"Internal server error: {str(e)}")

# 6. Modal stub setup
import modal

modal_app = modal.App("lunarian-backend-modal")

# Build image with all dependencies your code needs:
modal_image = (
    modal.Image.debian_slim()
    .pip_install([
        "torch", "numpy", "Pillow", "requests",
        "segment-anything","torchvision"
    ])
    .env({
        "SAM_CHECKPOINT_PATH": SAM_CHECKPOINT_PATH,
        "SAM_CHECKPOINT_URL": SAM_CHECKPOINT_URL,
        "SAM_MODEL_TYPE": SAM_MODEL_TYPE,
        # any other non-sensitive vars
    })
)

# Environment variables for Modal function


@modal_app.function(
    image=modal_image,
    gpu="A10G",
    timeout=800,
)
@modal.asgi_app()
def fastapi_app():
    return app

if __name__ == "__main__":
    # For local testing: set SAM_CHECKPOINT_URL in your environment and ensure internet access
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
