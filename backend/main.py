import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

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

# --- FRONTEND ROUTES ---
@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/leads")
async def read_leads():
    return FileResponse(os.path.join(FRONTEND_DIR, "leads.html"))

@app.get("/style.css")
async def read_style():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"))

@app.get("/worker.js")
async def read_worker():
    return FileResponse(os.path.join(FRONTEND_DIR, "worker.js"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)