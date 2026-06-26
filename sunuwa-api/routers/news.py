from fastapi import APIRouter
import feedparser
from bs4 import BeautifulSoup
import os

router = APIRouter()

FEEDS = [
    {"url": "https://www.setopati.com/rss", "source": "Setopati"},
    {"url": "https://www.onlinekhabar.com/feed", "source": "OnlineKhabar"},
    {"url": "https://ratopati.com/feed", "source": "Ratopati"},
]

# Keywords to categorize news into complaint categories
NEWS_KEYWORDS = {
    "Education": ["शिक्षा", "विद्यालय", "NEB", "SLC", "परीक्षा", "school", "exam", "university", "छात्र"],
    "Infrastructure": ["सडक", "बाटो", "पुल", "निर्माण", "road", "bridge", "construction", "transport"],
    "Health": ["स्वास्थ्य", "अस्पताल", "डाक्टर", "औषधि", "hospital", "health", "medicine", "doctor"],
    "Water": ["पानी", "खानेपानी", "KUKL", "water", "supply", "pipe"],
    "Electricity": ["बिजुली", "NEA", "electricity", "power", "load", "energy"],
    "Corruption": ["भ्रष्टाचार", "घूस", "CIAA", "corruption", "bribe", "fraud"],
}


def strip_html(text: str) -> str:
    """Remove HTML tags from RSS feed summaries."""
    if not text:
        return ""
    return BeautifulSoup(text, "html.parser").get_text().strip()


def categorize_news(title: str, summary: str) -> str:
    """Guess which complaint category a news headline belongs to."""
    combined = (title + " " + summary).lower()
    for category, keywords in NEWS_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in combined:
                return category
    return "Other"


@router.post("/fetch-news")
def fetch_news():
    """Fetch latest news from Nepali RSS feeds and save to Supabase."""
    from supabase import create_client

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    articles = []

    for feed_config in FEEDS:
        try:
            feed = feedparser.parse(feed_config["url"])
            for entry in feed.entries[:10]:
                title = strip_html(entry.get("title", ""))
                summary = strip_html(entry.get("summary", ""))[:400]
                if not title:
                    continue
                articles.append({
                    "title": title,
                    "summary": summary,
                    "url": entry.get("link", ""),
                    "source": feed_config["source"],
                    "category_en": categorize_news(title, summary),
                })
        except Exception as e:
            # Never let one bad feed crash the whole scraper
            print(f"Feed error [{feed_config['source']}]: {e}")
            continue

    if articles:
        # Clear old news and insert fresh
        db.table("news_items").delete().neq("id", 0).execute()
        db.table("news_items").insert(articles).execute()

    return {"status": "ok", "fetched": len(articles), "sources": [f["source"] for f in FEEDS]}


@router.get("/news")
def get_news(category: str = None, limit: int = 20):
    """Get news items, optionally filtered by category."""
    from supabase import create_client

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    query = db.table("news_items").select("*").order("fetched_at", desc=True).limit(limit)
    if category:
        query = query.eq("category_en", category)

    result = query.execute()
    return {"news": result.data or []}
