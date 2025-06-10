# test_debug_mask.py
import base64
import requests
import json # For printing the response nicely

# --- Configuration ---
# Make sure these files exist in the same directory as this script,
# or provide the full path.
SOURCE_IMAGE_PATH = "test.jpg"  # The image you want to test the hero mask detection on
OUTPUT_IMAGE_PATH = "debug_mask_output.png" # Where the debug visualization will be saved
DEBUG_ENDPOINT_URL = "http://localhost:8000/debug_hero_mask"
# --- End Configuration ---

def image_to_data_url(filepath):
    """Converts an image file to a data URL."""
    try:
        with open(filepath, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Basic MIME type detection based on extension
        if filepath.lower().endswith((".jpg", ".jpeg")):
            mime_type = "image/jpeg"
        elif filepath.lower().endswith(".png"):
            mime_type = "image/png"
        elif filepath.lower().endswith(".webp"):
            mime_type = "image/webp"
        else:
            # Fallback or raise error if you want to be strict
            print(f"Warning: Unknown MIME type for {filepath}, defaulting to image/jpeg.")
            mime_type = "image/jpeg" 
            
        return f"data:{mime_type};base64,{encoded_string}"
    except FileNotFoundError:
        print(f"Error: Source image file not found at '{filepath}'")
        return None
    except Exception as e:
        print(f"Error encoding image {filepath} to data URL: {e}")
        return None

def save_data_url_to_image(data_url, output_filepath):
    """Saves an image data URL to a file."""
    try:
        if "," not in data_url:
            print("Error: Invalid data URL format (missing comma).")
            return False
            
        header, encoded_data = data_url.split(",", 1)
        image_data = base64.b64decode(encoded_data)
        
        with open(output_filepath, "wb") as f:
            f.write(image_data)
        print(f"✅ Successfully wrote debug image to: {output_filepath}")
        return True
    except Exception as e:
        print(f"Error saving image from data URL to {output_filepath}: {e}")
        return False

def main():
    # 1) Load & encode your source image
    src_data_url = image_to_data_url(SOURCE_IMAGE_PATH)

    if not src_data_url:
        print("Exiting due to error with source image.")
        return

    # 2) Build the payload for the debug endpoint
    # The debug endpoint in app_py_typeerror_fix (V0.2.4) reuses GenerateRequest,
    # so we send sourceImage. Other fields are optional in GenerateRequest.
    payload = {
        "sourceImage": src_data_url,
        # These are not strictly needed by the /debug_hero_mask endpoint as defined,
        # but including them won't hurt if GenerateRequest is the Pydantic model.
        "userInputHeroBbox":{ "x": 200, "y": 100, "width": 600, "height": 700},
        "brandLogo": None, 
        "brandColor": "#000000",
        "brandPosition": "top_left",
        "adCopy": None,
        "includeCta": False,
        "ctaText": None,
        "formats": [{"id": "debug", "width": 100, "height": 100}] # Dummy format
    }

    # 3) POST to your running backend's debug endpoint
    print(f"Sending request to: {DEBUG_ENDPOINT_URL}")
    try:
        resp = requests.post(DEBUG_ENDPOINT_URL, json=payload)
        resp.raise_for_status()  # Will error out if status != 200

        # 4) Process the response
        response_data = resp.json()
        print("\nResponse from server:")
        print(json.dumps(response_data, indent=2)) # Pretty print the JSON response

        if "debug_image" in response_data and response_data["debug_image"]:
            save_data_url_to_image(response_data["debug_image"], OUTPUT_IMAGE_PATH)
        else:
            print("❌ No 'debug_image' found in the response.")

        if "hero_bbox" in response_data:
            print(f"Detected hero_bbox: {response_data['hero_bbox']}")
        else:
            print("No 'hero_bbox' found in the response.")

    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection Error: Could not connect to the server at {DEBUG_ENDPOINT_URL}.")
        print("   Please ensure your FastAPI server (uvicorn app:app --reload) is running.")
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e.response.status_code} {e.response.reason}")
        print(f"   Response content: {e.response.text}")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
