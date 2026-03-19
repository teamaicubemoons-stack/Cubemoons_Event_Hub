import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import httpx

# Fix path to allow importing from 'backend'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.config import logger, FRONTEND_DIR
from backend.core.models import OCRRequest
from backend.services.ocr_service import extract_card_data
from backend.services.enrichment_service import run_waterfall_enrichment
from backend.utils.sheets import submit_to_sheets

app = FastAPI(title="Business Card OCR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.post("/ocr")
async def perform_ocr(request: OCRRequest):
    try:
        # 1. OCR
        ocr_data = await extract_card_data(request.base64Image1, request.base64Image2)
        
        # 2. Enrichment
        final_data = await run_waterfall_enrichment(ocr_data)
        
        # 3. Stats & Score
        confidence_score = 0
        if final_data.get("is_validated"): confidence_score += 30
        if final_data.get("website"): confidence_score += 20
        try:
             trust_val = int(str(final_data.get("trust_score", "0")).split('/')[0].strip())
             confidence_score += (trust_val * 2) 
        except: pass
        if final_data.get("social_media"): confidence_score += 10
        
        # 4. Sheet Submission
        payload = {
            "action": "save",
            "extractedData": final_data,
            "confidence_score": confidence_score,
            "photo1Base64": request.base64Image1, 
            "photo2Base64": request.base64Image2 or ""
        }
        
        # Log the final enriched data to terminal
        import json
        logger.info(f"FINAL DATA TO SAVE:\n{json.dumps(final_data, indent=4)}")
        
        submit_to_sheets(payload)
        
        return {"success": True, "data": final_data, "confidence_score": confidence_score}

    except Exception as e:
        logger.error(f"Global Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-event")
async def save_event(request: dict):
    try:
        # Request is expected to contain 'eventData'
        payload = {
            "action": "save_event",
            "eventData": request.get("eventData")
        }
        
        # Submit to Sheets via existing utility
        resp = submit_to_sheets(payload)
        
        if resp and resp.status_code == 200:
            try:
                sheet_res = resp.json()
                return {"success": True, **sheet_res}
            except:
                return {"success": True, "message": "Event saved"}
        else:
            raise Exception("Failed to save to Google Sheets via Apps Script")

    except Exception as e:
        logger.error(f"Save Event Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/proxy-image")
async def proxy_image(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch image")
            
            return Response(content=resp.content, media_type=resp.headers.get("content-type", "image/png"))
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- FRONTEND ASSETS ---
from fastapi.staticfiles import StaticFiles
# Mount main frontend assets
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")

# Mount Scanner Build (React)
# Use dynamic path for cloud compatibility
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCANNER_DIST = os.path.join(PROJECT_ROOT, "BotivateScanner", "dist")

if os.path.exists(SCANNER_DIST):
    app.mount("/scanner", StaticFiles(directory=SCANNER_DIST, html=True), name="scanner")
else:
    logger.warning(f"Scanner Dist directory not found at {SCANNER_DIST}")

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/leads.html")
@app.get("/leads")
async def read_leads():
    return FileResponse(os.path.join(FRONTEND_DIR, "leads.html"))

# Map individual files for root level access if needed by the index.html
@app.get("/style.css")
async def read_style():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"))

@app.get("/worker.js")
async def read_worker():
    return FileResponse(os.path.join(FRONTEND_DIR, "worker.js"))

@app.get("/vcard-direct")
async def vcard_direct(name: str, org: str, phone: str, email: str):
    content = f"BEGIN:VCARD\nVERSION:3.0\nFN:{name}\nORG:{org}\nTEL;TYPE=CELL,VOICE:+91{phone}\nEMAIL;TYPE=PREF,INTERNET:{email}\nEND:VCARD"
    return Response(
        content=content,
        media_type="text/vcard",
        headers={
            "Content-Disposition": f'attachment; filename="{name}.vcf"',
            "Content-Type": "text/vcard; charset=utf-8"
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*80)
    print("🚀 TARGET SERVER STARTING - V2.0.0 (NEW_UPDATE) 🚀")
    print("SERVICING SCANNER FROM: " + SCANNER_DIST)
    print("="*80 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)