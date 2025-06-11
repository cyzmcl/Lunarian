# backend/app.py
import sys
import os
import traceback
import base64
import torch
import numpy as np
import httpx

from io import BytesIO
from typing import List, Dict, Optional, Tuple, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from PIL import Image, ImageDraw, ImageFont
from collections import defaultdict

# Assuming SAM is in a subdirectory or installed
try:
    from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
except ImportError:
    print("SAM not found, automatic hero detection will be limited.")
    SamPredictor = None
    sam_model_registry = None
    SamAutomaticMaskGenerator = None

# --- Pydantic Models ---
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
    copyFontFamily: Optional[str] = "/fonts/arial.ttf"
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
    ctaFont: Optional[str] = "/fonts/arial.ttf" 
    ctaTextColor: Optional[str] = "#FFFFFF"
    ctaBgColor: Optional[str] = "#000000"

    formats: List[FormatItem]

class GenerateResponse(BaseModel):
    results: Dict[str,str]

# --- Globals & Initialization ---
app = FastAPI()
origins = [
    "http://localhost:3000",
    "https://www.lunarianworks.com",
    "https://lunarianworks.com",
    # You can add other domains here if needed, like a staging environment
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_methods=["*"],
    allow_headers=["*"], allow_credentials=True,
)

device = "cuda" if torch.cuda.is_available() else "cpu"
backend_dir = os.path.dirname(__file__)

# --- NEW FONT HANDLING LOGIC ---
# This section replaces the old font setup.
FONT_DIR = os.path.join(backend_dir, "fonts")
DEFAULT_FONT_PATH = os.path.join(FONT_DIR, "arial.ttf")

# This map connects the filenames from the frontend to the full paths on the server.
# Ensure these font files exist in your `backend/fonts/` directory.
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

# --- End of new font handling ---

sam_checkpoint_path = os.path.join(backend_dir, "sam_vit_b_01ec64.pth")
sam_model_type = "vit_b"
predictor = None

# Removed global font variables like default_font_pil and current_font_path

try:
    if SamPredictor and sam_model_registry and os.path.exists(sam_checkpoint_path):
        print(f"Loading SAM model from: {sam_checkpoint_path}")
        sam = sam_model_registry[sam_model_type](checkpoint=sam_checkpoint_path)
        sam.to(device)
        predictor = SamPredictor(sam)
        print("✅ SAM model loaded.")
    else:
        print(f"❌ SAM predictor not initialized. Check path or SAM installation. Path: {sam_checkpoint_path}, Exists: {os.path.exists(sam_checkpoint_path)}")
except Exception as e:
    print(f"Error during global initializations: {e}"); traceback.print_exc()

# --- Utility Functions ---
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

# --- Main Ad Generation Logic ---
@app.post("/generate")
async def proxy_generate(req: GenerateRequest):
    """
    Proxy /generate requests to the Modal endpoint.
    Expects environment variable MODAL_URL set to base URL (without trailing slash),
    e.g. 'https://cyzmcl--lunarian-backend-modal-fastapi-app.modal.run'.
    """
    modal_base = os.getenv("MODAL_URL")
    if not modal_base:
        raise HTTPException(status_code=500, detail="MODAL_URL environment variable not set")

    # Construct full URL for Modal generate endpoint
    # Ensure no double slash: if MODAL_URL ends with '/', strip it
    modal_url = modal_base.rstrip("/") + "/generate"

    try:
        # Timeout: adjust based on expected inference time
        timeout_seconds = float(os.getenv("MODAL_REQUEST_TIMEOUT", "300"))
    except ValueError:
        timeout_seconds = 300.0

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            # Forward JSON body exactly
            resp = await client.post(modal_url, json=req.dict())
            # If Modal returned non-2xx, raise for status to catch below
            resp.raise_for_status()
            # Return the JSON as-is
            return resp.json()
    except httpx.HTTPStatusError as e:
        # Modal responded with an HTTP error code
        status = e.response.status_code
        # Attempt to read response body for detail
        try:
            detail_text = e.response.text
        except Exception:
            detail_text = "<failed to read Modal error body>"
        raise HTTPException(status_code=status, detail=f"Modal error: {detail_text}")
    except httpx.RequestError as e:
        # Network or timeout errors
        raise HTTPException(status_code=502, detail=f"Error calling Modal: {e}")
    except Exception as e:
        # Unexpected errors
        raise HTTPException(status_code=500, detail=f"Unexpected error proxying to Modal: {e}")


# --- Debug Endpoint ---
@app.post("/debug_hero_mask")
async def debug_hero_mask_endpoint(req: GenerateRequest):
    try:
        src_img_pil = decode_data_url(req.sourceImage)
        ow, oh = src_img_pil.size
        print(f"Debug: Img size: {src_img_pil.size}, mode: {src_img_pil.mode}")
        
        hero_bbox = get_hero_bbox_from_input_or_sam(src_img_pil.copy(), req.userInputHeroBbox)
        
        viz = src_img_pil.copy().convert("RGBA")
        draw_viz = ImageDraw.Draw(viz)
        
        debug_font_size = max(15, int(min(ow,oh)*0.03)) 
        # Use the default font path for debugging text
        dfont = ImageFont.truetype(DEFAULT_FONT_PATH, debug_font_size)
        
        if hero_bbox:
            x1,y1,x2,y2 = hero_bbox
            draw_viz.rectangle([x1,y1,x2,y2],outline="lime",width=max(1,int(min(ow,oh)*0.005))) 
            
            hero_mask_overlay = Image.new("RGBA", src_img_pil.size, (0,0,0,0)) 
            draw_hero_mask = ImageDraw.Draw(hero_mask_overlay)
            draw_hero_mask.rectangle([x1,y1,x2,y2], fill=(0,255,0,70)) 
            viz = Image.alpha_composite(viz, hero_mask_overlay)
            
            draw_viz = ImageDraw.Draw(viz)
            draw_viz.text((10,10),f"Hero BBox: ({x1},{y1})-({x2},{y2})",fill="lime",font=dfont)
        else: 
            draw_viz.text((10,10),"No hero bbox detected.",fill="red",font=dfont)
            
        return {"debug_image":encode_image_to_data_url(viz),"hero_bbox":hero_bbox,"image_size":src_img_pil.size}
    except Exception as e: 
        print(f"Error in /debug_hero_mask: {e}"); traceback.print_exc()
        raise HTTPException(status_code=500,detail=str(e))