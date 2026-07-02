<div align="center">

# 🇳🇵 Sunuwa (सुनुवाइ)

### Nepal's Civic Intelligence Platform

**Turning scattered citizen complaints into organized, actionable government intelligence.**

*नागरिकको आवाज, सरकारसम्म।*

[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3-orange?style=flat-square)](https://groq.com/)

</div>

---

## 📖 About

In Nepal, citizens face real problems with public services but have no clear way to report them. Most people post complaints on social media hoping someone notices, or visit government offices repeatedly without getting answers. Their voices end up scattered across Facebook, informal conversations, and unread posts.

**Sunuwa** is a platform that fixes this. It gives citizens one simple place to report problems — in Nepali or English, in under a minute — and then it actually does something with each complaint instead of letting it disappear.

Complaints are automatically classified, routed to the correct government office, and **escalated up the chain if they're ignored**. Citizens can track what happens next, and government officials get dashboards showing what's urgent, which areas are most affected, and what needs attention right now.

> **The core idea:** If citizens can easily report problems and governments can clearly see what's happening in real time, small issues can be solved before they become big ones.

---

## 💡 What Inspired This

After the Grade 12 (NEB) results were published in June 2026, social media was flooded with thousands of student complaints about retake fees, result quality, and other issues. Thousands of voices — but no organized way for their concerns to reach the people in charge.

The problem wasn't that authorities didn't care. It was that there was no system to **collect, organize, and present** citizen feedback in a way decision-makers could act on. Sunuwa was born from that gap.

---

## ✨ Key Features

### For Citizens
- **One-minute complaint submission** in Nepali or English — no complex forms
- **AI-generated smart forms** that ask only for the information relevant to your specific problem
- **Map-based location pinning** so authorities know exactly where the issue is
- **Public dashboard** showing what kinds of complaints are being made and where
- **Transparent tracking** of complaint status and government response

### For Government Officials
- **Ward-level dashboard** with an interactive map of complaints in their area
- **AI severity scoring** to prioritize the most urgent issues first
- **Status updates & response tools** to respond directly to citizens
- **National intelligence dashboard** with complaint heatmaps and category trends
- **AI-generated intelligence briefs** summarizing clustered issues for ministers

### The Accountability Engine
- **Automatic escalation** — complaints start at the ward office; if unresolved past a deadline, they move up to the municipality, then the ministry
- **Chain-of-command routing** following Nepal's three-tier government structure
- **No complaint gets ignored** — the system pushes issues upward on its own

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js (App Router), Tailwind CSS |
| **Maps** | Leaflet.js / React-Leaflet |
| **Backend** | FastAPI (Python) |
| **Database & Auth** | Supabase (PostgreSQL) |
| **AI — Classification & Severity** | Llama 3.3 via Groq |
| **AI — Report Generation** | Gemini Flash |
| **AI — Semantic Understanding** | Sentence-Transformer embeddings |
| **AI — Clustering** | UMAP + HDBSCAN |

### How the intelligence layer works
1. **Classification** — Llama 3.3 (via Groq) categorizes each complaint and reasons about its severity in the context of Nepal
2. **Embeddings** — Sentence-transformers convert complaints into vectors to understand their meaning
3. **Clustering** — UMAP + HDBSCAN group similar complaints to surface emerging issues
4. **Briefing** — Gemini Flash generates readable summaries of each cluster for decision-makers

---

## 🏗️ Architecture

```
Citizen submits complaint (Nepali/English)
          │
          ▼
   AI Classification ──► Severity Score ──► Location Pin
          │
          ▼
   Routed to Ward Office
          │
   ┌──────┴───────┐
   │  Resolved?   │
   └──────┬───────┘
          │ No (SLA exceeded)
          ▼
   Escalate → Municipality → Ministry
          │
          ▼
   Clustered & summarized → Intelligence Dashboards
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Supabase account
- A Groq API key
- A Gemini API key

### Setup

**1. Clone the repository**
```bash
git clone https://github.com/calypx/sunuwa.git
cd sunuwa
```

**2. Frontend setup**
```bash
cd frontend
npm install
```

**3. Backend setup**
```bash
cd backend
pip install -r requirements.txt
```

**4. Environment variables**

Create a `.env` file in the backend directory:
```dotenv
SUPABASE_URL="your_supabase_url"
SUPABASE_KEY="your_supabase_key"
GROQ_API_KEY="your_groq_key"
GEMINI_API_KEY="your_gemini_key"
```

Create a `.env.local` file in the frontend directory:
```dotenv
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

> ⚠️ **Never commit your `.env` files or API keys to GitHub.** Add them to `.gitignore`.

**5. Run the app**

Backend:
```bash
cd backend
uvicorn main:app --reload
```

Frontend:
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 Team VagaBond

Built by three 18-year-old developers passionate about civic technology in Nepal.

| Name | Role |
|------|------|
| **Rohit Poudel** | Team Lead / Product & AI Integration |
| **Pujan Bhatt** | Full Stack / System Design |
| **Sudarshan Subedi** | Frontend / UI-UX |

---

## 🎯 Roadmap

- [ ] Photo-first reporting — take a photo, AI generates the complaint
- [ ] AI image authenticity verification to prevent fake reports
- [ ] Before/after resolution proof photos
- [ ] Crowdsourced complaint verification
- [ ] Offline-first submission with background sync
- [ ] SMS notifications for status updates

---

## 🤝 Contributing

This project was built for a hackathon and is a work in progress. Contributions, ideas, and feedback are welcome — feel free to open an issue or submit a pull request.

---

## 📄 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Sunuwa** — because every citizen's voice deserves to be heard.

*Made with ❤️ in Nepal 🇳🇵*

</div>
