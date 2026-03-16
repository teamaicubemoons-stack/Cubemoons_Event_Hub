import re
import json
from backend.core.config import async_client, logger
from backend.core.models import OCRResponse
from backend.services.search_service import google_search
from backend.services.scraping_service import scrape_jina

async def run_waterfall_enrichment(ocr_data: dict):
    logger.info("Starting Waterfall Enrichment (Step 2)...")
    
    company_q = ocr_data.get('company', '')
    location_q = ocr_data.get('location', '')
    email_q = ocr_data.get('email', '')
    website_q = ocr_data.get('website', '')

    # --- Phase 1: Identity Resolution ---
    official_url = ""
    
    # A: Direct
    if website_q and website_q.startswith("http"):
        official_url = website_q
    
    # B: Email Domain
    if not official_url and email_q and "@" in email_q:
        domain = email_q.split("@")[-1].strip()
        generic = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com', 'ymail.com', 'live.com']
        if domain and domain.lower() not in generic:
            official_url = f"https://www.{domain}"
            
    # C: Google CSE
    if not official_url and company_q:
        items = await google_search(f"{company_q} {location_q} official website", 5)
        for item in items:
            link = item.get("link", "")
            if not any(x in link.lower() for x in ['zauba', 'tofler', 'justdial', 'indiamart', 'tradeindia', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'youtube.com']):
                official_url = link
                break
        if not official_url and items:
            official_url = items[0].get("link", "")

    # --- Phase 2: Scraping ---
    official_markdown = await scrape_jina(official_url) if official_url else ""
    
    zauba_url = ""
    zauba_markdown = ""
    if company_q:
        zauba_items = await google_search(f"{company_q} {location_q} site:zaubacorp.com OR site:tofler.in", 2)
        if zauba_items:
            zauba_url = zauba_items[0].get("link", "")
            if zauba_url:
                zauba_markdown = await scrape_jina(zauba_url)

    # --- Phase 3: Social Links Parsing ---
    social_pattern = re.compile(
        r'https?://(?:www\.)?'
        r'(?:instagram\.com/[\w.\-]+|facebook\.com/(?:pages/)?[\w.\-/]+|fb\.com/[\w.\-]+|linkedin\.com/(?:company|in|school|showcase)/[\w.\-]+|twitter\.com/[\w.\-]+|x\.com/[\w.\-]+|youtube\.com/(?:@|channel/|c/|user/)[\w.\-]+|youtube\.com/[\w.\-]+|pinterest\.com/[\w.\-]+|wa\.me/[\w.\-+]+|api\.whatsapp\.com/send\?phone=[\w.\-+]+|t\.me/[\w.\-]+|threads\.net/@[\w.\-]+)',
        re.IGNORECASE
    )
    
    found_socials = set()
    if official_markdown:
        matches = social_pattern.findall(official_markdown)
        for m in matches:
            cleaned = m.split("?")[0].rstrip("/")
            if not any(x in cleaned.lower() for x in ['/p/', '/reel/', '/status/', '/posts/', '/video/']):
                found_socials.add(cleaned)
    
    # Backup Search for Socials
    if not found_socials and company_q:
        social_items = await google_search(f"{company_q} {location_q} Instagram Facebook LinkedIn", 6)
        for item in social_items:
            link = item.get('link', '')
            if any(x in link.lower() for x in ['instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'youtube.com']):
                cleaned = link.split("?")[0].rstrip("/")
                if not any(x in cleaned.lower() for x in ['/p/', '/reel/', '/status/', '/posts/', '/video/']):
                    found_socials.add(cleaned)

    social_links_str = "\n".join(sorted(found_socials))
    
    # --- Phase 4: GPT-4o Synthesis ---
    combined_search_context = f"""
    1. WEB: {official_url}
    2. SOCIALS: {social_links_str}
    3. LEGAL URL: {zauba_url}
    4. WEB CONTENT: {official_markdown[:15000]}
    5. LEGAL CONTENT: {zauba_markdown[:5000]}
    """
    
    extraction_prompt = f"""
    investigation report: {combined_search_context}
    original card: {json.dumps(ocr_data)}
    Rules: Clean socials, find single best validation_source, identify key people, calc trust score 0-10.
    """
    
    completion = await async_client.beta.chat.completions.parse(
        model="gpt-4o", 
        messages=[
            {"role": "system", "content": "You are a precise JSON extractor and verification agent."},
            {"role": "user", "content": extraction_prompt}
        ],
        response_format=OCRResponse, 
    )
    
    final_data = completion.choices[0].message.parsed.model_dump()
    logger.info("Waterfall Enrichment Complete.")
    return final_data
