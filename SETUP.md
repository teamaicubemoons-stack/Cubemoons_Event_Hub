# 🛠️ Setup Guide — Business Card Reader

This guide walks you through setting up the Business Card Reader from scratch on your local machine.

---

## 📋 Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Python** | 3.10 or higher | `python --version` |
| **pip** | Latest | `pip --version` |
| **Git** | Any | `git --version` |
| **OpenAI Account** | With API access | [platform.openai.com](https://platform.openai.com) |
| **Google Cloud Account** | Free tier works | [console.cloud.google.com](https://console.cloud.google.com) |
| **Google Account** | For Google Sheets | Any Gmail account |

---

## 🚀 Step 1: Clone the Repository

```bash
git clone https://github.com/teamai-botivate/Bussiness_Card_Reader.git
cd Bussiness_Card_Reader
```

---

## 🐍 Step 2: Set Up Python Virtual Environment

### Windows
```bash
python -m venv .venv
.venv\Scripts\activate
```

### macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
```

You should see `(.venv)` or `(Business-Card-OCR)` in your terminal prompt.

---

## 📦 Step 3: Install Dependencies

```bash
pip install -r backend/requirements.txt
```

This installs:
- `fastapi` — Web framework
- `uvicorn` — ASGI server
- `openai` — OpenAI Python SDK
- `httpx` — Async HTTP client (used for Jina scraping & Google CSE)
- `pydantic` — Data validation
- `python-dotenv` — Environment variable loader
- `requests` — HTTP client (used for Google Apps Script submission)

---

## 🔑 Step 4: Get Your API Keys

You need **4 keys** total. Here's how to get each one:

### 4.1 — OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Name it `Business Card Reader`
4. Copy the key (starts with `sk-proj-...`)
5. **Important:** You need credits in your OpenAI account. The system uses `gpt-4o` which costs ~$2.50 per 1M input tokens.

### 4.2 — Google Custom Search API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Library**
4. Search for **"Custom Search API"** and click on it
5. Click **"Enable"**
6. Go to **APIs & Services → Credentials**
7. Click **"+ Create Credentials" → "API Key"**
8. Copy the generated key (starts with `AIza...`)
9. *(Optional but recommended)* Click **"Edit key"**:
   - Set **API restrictions** → **Restrict key** → Select **Custom Search API**
   - Click **Save**

### 4.3 — Google Programmable Search Engine ID (CSE ID)

1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all)
2. Click **"Add"** to create a new search engine
3. Fill in:
   - **Name:** `Business Card Reader`
   - **Sites to search:** Enter `www.google.com` (placeholder — we'll search the whole web)
4. Click **"Create"**
5. After creation, find and **enable "Search the entire web"** toggle
   - Go to your search engine settings → Look for the toggle → Turn it **ON**
6. Copy the **Search Engine ID** (looks like `0441dbb7ce6ee45b9`)

> ⚠️ **Critical:** If "Search the entire web" is not enabled, the search will only look at `www.google.com` and return no useful results!

### 4.4 — Google Apps Script URL

This is needed to save the extracted data to a Google Sheet. Follow the detailed guide in [APPS_SCRIPT_GUIDE.md](APPS_SCRIPT_GUIDE.md).

**Quick summary:**
1. Create a new Google Sheet
2. Go to **Extensions → Apps Script**
3. Paste the code from `FINAL_APPS_SCRIPT.js`
4. Deploy as a **Web App** (execute as yourself, allow anyone to access)
5. Copy the deployed URL (starts with `https://script.google.com/macros/s/...`)

---

## 📝 Step 5: Create the `.env` File

Create a file named `.env` inside the `backend` directory:

**Path:** `backend/.env`

```env
OPENAI_API_KEY=sk-proj-your-openai-key-here
GOOGLE_API_KEY=AIzaSy-your-google-api-key-here
GOOGLE_CSE_ID=your-cse-id-here
APPS_SCRIPT_URL=https://script.google.com/macros/s/your-script-id/exec
```

> ⚠️ **Never commit this file to Git!** It is already listed in `.gitignore`.

---

## ▶️ Step 6: Run the Application

```bash
python backend/main.py
```

You should see:
```
--- LOADING main.py (POWERED BY FULL OPENAI PIPELINE) ---
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

---

## 🌐 Step 7: Open the Frontend

Open your browser and navigate to:
**http://127.0.0.1:8000**

The Python server now serves both the AI OCR API and the Web Interface on the same port.

---

## 🧪 Step 8: Test It Out

1. Open **http://127.0.0.1:8000** in your browser
2. Upload a business card image (front side)
3. Optionally upload the back side too
4. Click **"Scan Card"**
5. Watch the terminal logs for the enrichment pipeline running
6. The extracted data will appear in your frontend and be saved to your Google Sheet

### Expected Terminal Output
```
INFO - Incoming request to /ocr
INFO - Step 1: Sending image(s) to OpenAI Vision (gpt-4o) for Extraction...
INFO - Step 1: Extracted Raw Data: {...}
INFO - Step 2: Starting Deterministic Waterfall Enrichment...
INFO - Phase 1: Identity Resolution...
INFO - Website derived from email domain: https://www.example.com
INFO - Phase 2: Deep Scraping with Jina Reader API...
INFO - Official Website Scraped: 8000 chars
INFO - Phase 3: Extracting Social Links from scraped content...
INFO - Social Links Found: https://www.instagram.com/example ...
INFO - Waterfall Enrichment Complete. Total Context Length: 9500
INFO - Structuring Data into Pydantic Schema...
INFO - Step 2: Structured Data Received: {...}
INFO - Confidence Score: 76
INFO - Step 6: Submitting final data to Google Apps Script...
INFO - Google Apps Script Response: 200
```

---

## 🔧 Troubleshooting

### Google CSE returns 403 Forbidden
- Your API key may have expired or hit the free tier limit (100 queries/day)
- Verify the key is active at [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
- Ensure **Custom Search API** is enabled in **APIs & Services → Library**
- The pipeline still works without Google CSE — it uses email domain + Jina scraping as the primary method

### OpenAI API errors
- Check your API key is valid and has credits
- Verify you have access to `gpt-4o` model
- Check rate limits at [OpenAI Usage](https://platform.openai.com/usage)

### Jina Reader returns empty content
- Some websites block scraping bots
- The pipeline will still extract what it can from OCR + Google CSE

### No social media links found
- If the company website doesn't have social links in their HTML, the regex won't find them
- Google CSE backup will attempt to find social profiles as a fallback

### CORS errors in browser
- Make sure the backend is running on `http://127.0.0.1:8000`
- The FastAPI server has CORS set to allow all origins (`*`)

---

## 📊 Free Tier Limits

| Service | Free Tier | Notes |
|---------|-----------|-------|
| **OpenAI GPT-4o** | $5 free credits (new accounts) | ~2-3 card scans per dollar |
| **Google Custom Search** | 100 queries/day | Used only as fallback |
| **Jina Reader API** | Unlimited (free tier) | Primary scraping tool |
| **Google Apps Script** | 20,000 calls/day | More than enough |

---

## 🚢 Deployment (Optional)

### Deploy Backend to a Cloud Server
The backend can be deployed to any server that supports Python:
- **AWS EC2** / **Google Cloud Run** / **Railway** / **Render**

```bash
# Example for production
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Deploy Frontend
The frontend is static HTML/CSS/JS and can be hosted on:
- **Vercel** (use the included `vercel.json`)
- **Netlify**
- **GitHub Pages**

> **Remember:** Update the API endpoint URL in `index.html` if your backend is not on `localhost`.

---

**Need help?** Open an issue on [GitHub](https://github.com/teamai-botivate/Bussiness_Card_Reader/issues).
