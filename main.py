import base64
print("--- LOADING main.py (POWERED BY FULL OPENAI PIPELINE) ---")
import logging
import json
import os
import asyncio
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

import openai
from openai import AsyncOpenAI
import urllib.parse

# --- CONFIGURATION ---
load_dotenv(override=True)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
APPS_SCRIPT_URL = os.getenv("APPS_SCRIPT_URL")

if not OPENAI_API_KEY:
    raise ValueError("No OPENAI_API_KEY found in .env file.")
if not APPS_SCRIPT_URL:
    raise ValueError("No APPS_SCRIPT_URL found in .env file.")

# Initialize Client
async_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# --- Basic Setup ---
app = FastAPI()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- Request/Response Models ---
class OCRRequest(BaseModel):
    base64Image1: str # From Card Front
    base64Image2: str | None = None # From Card Back

class KeyPerson(BaseModel):
    name: str = Field(default="Not Found")
    role: str = Field(default="Not Found")
    contact: str = Field(default="Not Found")

class OCRResponse(BaseModel):
    # --- Card Data ---
    company: str = Field(default="", description="Company Name from Card")
    name: str = Field(default="", description="Person Name from Card")
    title: str = Field(default="", description="Job Title from Card")
    phone: str = Field(default="", description="Phone Number from Card")
    email: str = Field(default="", description="Email from Card")
    address: str = Field(default="", description="Address from Card")
    location: str = Field(default="", description="City/State from Card")
    
    # --- Enriched Data (Web Search) ---
    industry: str = Field(default="", description="Industry/Sector")
    website: str = Field(default="", description="Official Website URL")
    social_media: str = Field(default="", description="Comma-separated List of Raw Profile URLs (e.g. https://instagram.com/xyz, https://facebook.com/abc)")
    services: str = Field(default="", description="List of services/products")
    company_size: str = Field(default="", description="Number of employees (e.g. 1-10)")
    founded_year: str = Field(default="", description="Year established")
    registration_status: str = Field(default="", description="Registration details (GST/CIN/Active)")
    trust_score: str = Field(default="0", description="Reliability score 0-10")
    key_people: list[KeyPerson] = Field(default_factory=list, description="List of key leadership found")
    key_people_str: str = Field(default="", description="Backup string of key people")
    
    # --- Meta Data ---
    validation_source: str = Field(default="", description="Source URL for verification")
    is_validated: bool = Field(default=False)
    about_the_company: str = Field(default="", description="Short description of company")
    slogan: str = Field(default="")

class BasicOCR(BaseModel):
    company: str
    name: str
    title: str
    phone: str
    email: str
    address: str
    slogan: str
    location: str
    website: str

# --- HELPER FUNCTIONS ---
async def google_search(query: str, num: int = 3):
    google_api = os.getenv("GOOGLE_API_KEY")
    google_cx = os.getenv("GOOGLE_CSE_ID")
    if not google_api or not google_cx:
        logger.error("Missing Google CSE credentials")
        return []
    try:
        import httpx
        url = f"https://www.googleapis.com/customsearch/v1?q={urllib.parse.quote(query)}&key={google_api}&cx={google_cx}&num={num}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            data = resp.json()
            return data.get("items") or []
    except Exception as e:
        logger.error(f"Google CSE Error: {e}")
        return []

async def scrape_jina(url: str):
    if not url or not url.startswith("http"): return ""
    logger.info(f"Deep Scraping URL: {url}")
    try:
        import httpx
        jina_url = f"https://r.jina.ai/{url}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(jina_url, headers={"X-Return-Format": "markdown"})
            if resp.status_code == 200:
                return resp.text[:30000] # Ensure we don't blow up context size
            return f"Scrape failed with {resp.status_code}"
    except Exception as e:
        logger.error(f"Jina Scrape Error: {e}")
        return ""

# --- API ENDPOINT ---
@app.post("/ocr", response_model=None)
async def perform_ocr(request: OCRRequest):
    logger.info("Incoming request to /ocr")
    logger.info(f"Image 1 Payload Size: {len(request.base64Image1)} chars")

    try:
        # --- Step 1: OpenAI Vision Extraction (OCR) ---
        logger.info("Step 1: Sending image(s) to OpenAI Vision (gpt-4o) for Extraction...")
        
        image_content = []
        # Add Image 1
        # Ensuring we prepend the right data type for OpenAI if not already there
        img1_data = request.base64Image1
        if not img1_data.startswith("data:image"):
            img1_data = f"data:image/jpeg;base64,{img1_data}"
        
        image_content.append({
            "type": "image_url",
            "image_url": {"url": img1_data} 
        })
        
        # Add Image 2 if exists
        if request.base64Image2:
            img2_data = request.base64Image2
            if not img2_data.startswith("data:image"):
                img2_data = f"data:image/jpeg;base64,{img2_data}"
            image_content.append({
                "type": "image_url",
                "image_url": {"url": img2_data}
            })
            
        # Add Prompt
        image_content.append({
            "type": "text",
            "text": """
            Extract text from this business card. 
            Use your vision capabilities to accurately read even stylized, rotated, or inverted text.
            Fields: company, name, title, phone, email, address, slogan, location, website.
            If a field is missing, use an empty string.
            """
        })

        ocr_response = await async_client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[{"role": "user", "content": image_content}],
            response_format=BasicOCR,
            temperature=0.0
        )
        
        ocr_data = ocr_response.choices[0].message.parsed.model_dump()
        logger.info(f"Step 1: Extracted Raw Data: {ocr_data}")

        # --- Step 2: Deterministic Waterfall Enrichment Pipeline ---
        logger.info("Step 2: Starting Deterministic Waterfall Enrichment...")

        try:
             company_q = ocr_data.get('company', '')
             location_q = ocr_data.get('location', '')
             email_q = ocr_data.get('email', '')
             website_q = ocr_data.get('website', '')

             # ===== PHASE 1: IDENTITY RESOLUTION (Domain from Email/Website) =====
             logger.info("Phase 1: Identity Resolution...")
             official_url = ""
             
             # Strategy A: Use website from the card directly
             if website_q and website_q.startswith("http"):
                 official_url = website_q
                 logger.info(f"Website found directly on card: {official_url}")
             
             # Strategy B: Extract domain from email (MOST RELIABLE!)
             if not official_url and email_q and "@" in email_q:
                 domain = email_q.split("@")[-1].strip()
                 # Skip generic email providers
                 generic_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com', 'ymail.com', 'live.com']
                 if domain and domain.lower() not in generic_domains:
                     official_url = f"https://www.{domain}"
                     logger.info(f"Website derived from email domain: {official_url}")
             
             # Strategy C: Google CSE Fallback (only if A and B both failed)
             if not official_url and company_q:
                 logger.info("No email domain found. Falling back to Google CSE...")
                 items = await google_search(f"{company_q} {location_q} official website", 5)
                 for item in items:
                     link = item.get("link", "")
                     if not any(x in link.lower() for x in ['zauba', 'tofler', 'justdial', 'indiamart', 'tradeindia', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'youtube.com']):
                         official_url = link
                         break
                 if not official_url and items:
                     official_url = items[0].get("link", "")
                 logger.info(f"Google CSE fallback resolved: {official_url}")
             
             logger.info(f"FINAL Official URL: {official_url}")

             # ===== PHASE 2: DEEP SCRAPING (Jina Reader) =====
             logger.info("Phase 2: Deep Scraping with Jina Reader API...")
             
             # Scrape official website
             official_markdown = await scrape_jina(official_url) if official_url else ""
             logger.info(f"Official Website Scraped: {len(official_markdown)} chars")
             
             # Scrape Zauba/Tofler for legal info (Google CSE for discovery)
             zauba_url = ""
             zauba_markdown = ""
             if company_q:
                 zauba_items = await google_search(f"{company_q} {location_q} site:zaubacorp.com OR site:tofler.in", 2)
                 if zauba_items:
                     zauba_url = zauba_items[0].get("link", "")
                     if zauba_url:
                         zauba_markdown = await scrape_jina(zauba_url)
                         logger.info(f"Zauba/Tofler Scraped: {len(zauba_markdown)} chars")
             
             # ===== PHASE 3: EXTRACT SOCIAL LINKS FROM WEBSITE CONTENT =====
             logger.info("Phase 3: Extracting Social Links from scraped content...")
             import re
             social_pattern = re.compile(
                 r'https?://(?:www\.)?'
                 r'(?:'
                 r'instagram\.com/[\w.\-]+|'
                 r'facebook\.com/(?:pages/)?[\w.\-/]+|'
                 r'fb\.com/[\w.\-]+|'
                 r'linkedin\.com/(?:company|in|school|showcase)/[\w.\-]+|'
                 r'twitter\.com/[\w.\-]+|'
                 r'x\.com/[\w.\-]+|'
                 r'youtube\.com/(?:@|channel/|c/|user/)[\w.\-]+|'
                 r'youtube\.com/[\w.\-]+|'
                 r'pinterest\.com/[\w.\-]+|'
                 r'wa\.me/[\w.\-+]+|'
                 r'api\.whatsapp\.com/send\?phone=[\w.\-+]+|'
                 r't\.me/[\w.\-]+|'
                 r'threads\.net/@[\w.\-]+'
                 r')',
                 re.IGNORECASE
             )
             
             found_socials = set()
             if official_markdown:
                 matches = social_pattern.findall(official_markdown)
                 for m in matches:
                     cleaned = m.split("?")[0].rstrip("/")  # Remove query params & trailing slashes
                     # Reject post/reel/status links
                     if not any(x in cleaned.lower() for x in ['/p/', '/reel/', '/status/', '/posts/', '/video/']):
                         found_socials.add(cleaned)
             
             social_links_str = "\n".join(sorted(found_socials))
             logger.info(f"Social Links Found: {social_links_str if social_links_str else 'None from website scrape'}")
             
             # ===== PHASE 4: ALSO TRY GOOGLE FOR SOCIAL (as backup) =====
             if not found_socials and company_q:
                 logger.info("No socials found on website. Trying Google CSE backup...")
                 social_items = await google_search(f"{company_q} {location_q} Instagram Facebook LinkedIn", 6)
                 for item in social_items:
                     link = item.get('link', '')
                     if any(x in link.lower() for x in ['instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'youtube.com']):
                         cleaned = link.split("?")[0].rstrip("/")
                         if not any(x in cleaned.lower() for x in ['/p/', '/reel/', '/status/', '/posts/', '/video/']):
                             found_socials.add(cleaned)
                 social_links_str = "\n".join(sorted(found_socials))
                 logger.info(f"Google backup socials: {social_links_str}")

             # ===== BUILD CONTEXT =====
             combined_search_context = f'''
             --- 1. VERIFIED OFFICIAL WEBSITE URL ---
             {official_url}

             --- 2. DISCOVERED SOCIAL MEDIA PROFILE URLS (USE THESE EXACTLY) ---
             {social_links_str}

             --- 3. VERIFIED LEGAL/ZAUBA URL ---
             {zauba_url}

             --- 4. OFFICIAL WEBSITE CONTENT (EXTRACT SERVICES, ADDRESS, CONTACT, ETC FROM HERE) ---
             {official_markdown[:15000]}

             --- 5. LEGAL REGISTRATION CONTENT (EXTRACT DIRECTORS, GST, FOUNDED YEAR FROM HERE) ---
             {zauba_markdown[:5000]}
             '''
             
             logger.info(f"Waterfall Enrichment Complete. Total Context Length: {len(combined_search_context)}")
             
             # --- Phase 2C: Structuring (OpenAI Structured Outputs) ---
             logger.info("Structuring Data into Pydantic Schema...")
             extraction_prompt = f'''
             You are a Data Entry Expert.
             Here is the deep investigation report:
             {combined_search_context}
             
             Using ONLY the information above (and the original card data), fill out the required JSON structure.
             Original Card Data: {json.dumps(ocr_data)}
             
             CRITICAL RULES:
             1. **Social Media**: 
                - EXTRACT ALL DISTINCT PLATFORMS found (Instagram, Facebook, LinkedIn, Twitter, YouTube).
                - CLEAN THE URLs: Remove query params (?ref=...).
                - REJECT specific post links like "/p/", "/reel/", "/status/", "/posts/", "/video/".
                - KEEP ONLY main profile links (e.g. "https://instagram.com/companyname").
                - Join multiple with commas.
             2. **Validation Source**:
                - Pick the SINGLE BEST URL that proves the company exists (e.g., GST Portal, Zauba Corp, or Official Website).
                - Put this URL in 'validation_source'.
             3. **Registration**: If GST/CIN found, mark 'registration_status' as Verified with ID.
             4. **Key People**: List Name, Role, Contact if found.
             5. **Trust Score**: 0-10 based on verification.
             '''
             
             completion = await async_client.beta.chat.completions.parse(
                model="gpt-4o", 
                messages=[
                    {"role": "system", "content": "You are a precise JSON extractor. Output valid structured data only."},
                    {"role": "user", "content": extraction_prompt}
                ],
                response_format=OCRResponse, 
             )
             
             final_data = completion.choices[0].message.parsed.model_dump()
             logger.info(f"Step 2: Structured Data Received: {final_data}")

             # Ensure boolean/list types are correct
             if "key_people" not in final_data or not final_data["key_people"]: final_data["key_people"] = []
             if "is_validated" not in final_data: final_data["is_validated"] = False

        except Exception as e:
             logger.error(f"Structured Output Parsing Failed: {e}. Fallback to manual JSON.")
             final_data = ocr_data 
             final_data["is_validated"] = False

        # --- Step 3: Confidence Score & Google Apps Script (Same as before) ---
        confidence_score = 0
        if final_data.get("is_validated"): confidence_score += 30
        if final_data.get("website"): confidence_score += 20
        try:
             trust_val = int(str(final_data.get("trust_score", "0")).split('/')[0].strip())
             confidence_score += (trust_val * 2) 
        except: pass
        if final_data.get("registration_status") and "Active" in str(final_data.get("registration_status", "")): confidence_score += 10
        if final_data.get("social_media"): confidence_score += 10
        
        logger.info(f"Confidence Score: {confidence_score}")

        # Clean up phone
        phone_number = str(final_data.get("phone", ""))
        if phone_number and phone_number.startswith('+'):
            final_data["phone"] = "'" + phone_number

        import requests
        logger.info("Step 6: Submitting final data to Google Apps Script...")
        try:
            apps_script_payload = {
                "action": "save",
                "extractedData": final_data,
                "confidence_score": confidence_score,
                "photo1Base64": request.base64Image1, 
                "photo2Base64": request.base64Image2 or ""
            }
            
            resp = requests.post(APPS_SCRIPT_URL, json=apps_script_payload)
            logger.info(f"Google Apps Script Response: {resp.status_code} - {resp.text}")
            
            return {"success": True, "data": resp.json()}
            
        except Exception as e:
            logger.error(f"Failed to send to Apps Script: {e}")
            return {"success": False, "error": str(e)}

    except Exception as e:
        logger.error(f"Processing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)