# 📇 Business Card Reader — AI-Powered OCR & Intelligence Platform

> **Scan a business card → Get verified company intel in seconds.**

An end-to-end system that uses **OpenAI GPT-4o Vision** to extract text from business card images, then enriches the data through a **Deterministic Waterfall Pipeline** — scraping the company's real website, extracting social media links, pulling legal registration data, and structuring everything into a clean, validated JSON payload saved directly to Google Sheets.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-blueviolet?logo=openai)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📸 **Dual-Side OCR** | Upload front & back of a business card — GPT-4o Vision reads even stylized, rotated, or inverted text |
| 🌐 **Website Auto-Discovery** | Extracts the company domain directly from the email address (e.g., `info@company.com` → `company.com`) — zero API dependency |
| 🕷️ **Deep Website Scraping** | Uses [Jina Reader API](https://jina.ai/reader/) to scrape the official website and extract services, address, and contact info |
| 📱 **Social Media Extraction** | Regex-based deterministic extraction of Instagram, Facebook, LinkedIn, Twitter/X, YouTube, WhatsApp, Telegram, Pinterest, and Threads links directly from the website footer |
| 🏛️ **Legal Verification** | Searches ZaubaCorp/Tofler via Google CSE to find GST, CIN, Directors, and incorporation year |
| 📊 **Confidence Scoring** | Generates a 0-100 confidence score based on validation checks |
| 📋 **Google Sheets Integration** | Auto-saves all extracted data + card images to a Google Sheet via Apps Script |
| 🔄 **Multi-Fallback Architecture** | Email domain → Card website → Google CSE fallback chain ensures data is always found |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     BUSINESS CARD IMAGE                          │
│                   (Front + Back, Base64)                          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1: OCR EXTRACTION (GPT-4o Vision)                          │
│  → Reads text from card images                                   │
│  → Outputs: company, name, title, phone, email, address, etc.   │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2: WATERFALL ENRICHMENT PIPELINE                           │
│                                                                  │
│  Phase 1: Identity Resolution                                    │
│  ├── Strategy A: Use website from card directly                  │
│  ├── Strategy B: Extract domain from email (MOST RELIABLE)       │
│  └── Strategy C: Google CSE fallback                             │
│                                                                  │
│  Phase 2: Deep Scraping (Jina Reader API)                        │
│  ├── Scrape official website → services, address, contacts       │
│  └── Scrape ZaubaCorp/Tofler → GST, Directors, founded year     │
│                                                                  │
│  Phase 3: Social Link Extraction (Regex)                         │
│  └── Parse scraped HTML for Instagram, FB, LinkedIn, etc.        │
│                                                                  │
│  Phase 4: Google CSE Social Backup                               │
│  └── Search Google for social profiles if Phase 3 finds none    │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3: STRUCTURED OUTPUT (GPT-4o + Pydantic)                   │
│  → Merges OCR data + enrichment into validated JSON              │
│  → Confidence score calculation                                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 4: GOOGLE SHEETS (Apps Script)                             │
│  → Saves structured data + card images to spreadsheet            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.10+, FastAPI, Uvicorn |
| **AI/OCR** | OpenAI GPT-4o Vision, Structured Outputs (`beta.parse`) |
| **Web Scraping** | Jina Reader API (`r.jina.ai`) |
| **Search** | Google Custom Search API (fallback) |
| **Frontend** | Vanilla HTML/CSS/JS |
| **Storage** | Google Sheets via Apps Script |
| **HTTP Client** | httpx (async), requests |

---

## 📂 Project Structure

```
Business-Card-OCR/
├── backend/                 # FastAPI backend logic
│   ├── main.py              # OCR + Enrichment pipeline
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # API keys (not committed)
├── frontend/                # Web Interface files
│   ├── index.html           # Main upload UI
│   ├── leads.html           # Leads dashboard
│   ├── style.css            # UI styling
│   └── worker.js            # Background sync worker
├── README.md                # Project overview
├── SETUP.md                 # Detailed setup instructions
├── APPS_SCRIPT_GUIDE.md     # Google Sheets setup
├── FINAL_APPS_SCRIPT.js     # Sheets automation code
├── vercel.json              # Deployment config
└── .gitignore               # Git exclusions
```

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/teamai-botivate/Bussiness_Card_Reader.git
cd Bussiness_Card_Reader

# 2. Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# 3. Install dependencies
# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Create .env file at /backend/.env
# (See SETUP.md for details)

# 5. Run the application
python run.py
```

Then open `http://127.0.0.1:8000` in your browser and start scanning cards!

> 📖 For detailed setup instructions, see **[SETUP.md](SETUP.md)**

---

## 📡 API Reference

### `POST /ocr`

Processes a business card image and returns enriched, structured data.

**Request Body:**
```json
{
  "base64Image1": "data:image/jpeg;base64,...",
  "base64Image2": "data:image/jpeg;base64,..."  // optional (back of card)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "company": "Grand Imperia",
    "name": "Rohit Kumar Sahu",
    "title": "F&B Manager",
    "phone": "+91 8871003018",
    "email": "banquetsales@grandimperiahotel.com",
    "address": "VIP Road, Vishal Nagar, Raipur, Chhattisgarh",
    "website": "https://www.grandimperiahotel.com",
    "social_media": "https://www.facebook.com/GrandImperia, https://www.instagram.com/grand.imperia.raipur",
    "industry": "Hospitality",
    "services": "Rooms, Amenities, Banquet, Dining",
    "trust_score": "8",
    "is_validated": true,
    "confidence_score": 76
  }
}
```

---

## 🔑 Required API Keys

| Key | Purpose | Get it from |
|-----|---------|-------------|
| `OPENAI_API_KEY` | GPT-4o Vision OCR + Structured Output | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `GOOGLE_API_KEY` | Google Custom Search (fallback) | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CSE_ID` | Programmable Search Engine ID | [CSE Control Panel](https://programmablesearchengine.google.com/) |
| `APPS_SCRIPT_URL` | Google Sheets data storage | See [APPS_SCRIPT_GUIDE.md](APPS_SCRIPT_GUIDE.md) |

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built with ❤️ by [Team AI Botivate](https://github.com/teamai-botivate)**
