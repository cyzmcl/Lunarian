# test_generate.py
import base64
import requests

# 1) Load & encode your source image
with open("test.jpg", "rb") as f:
    src_b64 = base64.b64encode(f.read()).decode()

# 2) Load & encode your logo
with open("logo.png", "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode()

# 3) Build the payload exactly as you specified:
payload = {
    "sourceImage":   f"data:image/jpeg;base64,{src_b64}",
    "brandLogo":     f"data:image/png;base64,{logo_b64}",
    "brandColor":    "#000000",
    "brandPosition": "top-center",
    "adCopy":        "Spring Collection",
    "includeCta":    True,
    "ctaText":       "SHOP",
    "formats": [
        { "id": "fb-feed-1200x628", "width": 1200, "height": 628 }
    ]
}

# 4) POST to your running backend
resp = requests.post("http://localhost:8000/generate", json=payload)
resp.raise_for_status()  # will error out if status != 200

# 5) Extract and save the returned image
data_url = resp.json()["results"]["fb-feed-1200x628"]
# strip off the "data:image/png;base64," prefix
b64 = data_url.split(",", 1)[1]

with open("out.png", "wb") as f:
    f.write(base64.b64decode(b64))

print("✅ Wrote out.png — open that to see your ad!")
