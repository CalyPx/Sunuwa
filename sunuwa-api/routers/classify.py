from fastapi import APIRouter, BackgroundTasks
from groq import Groq
import json
import os

router = APIRouter()

CATEGORIES_NE = {
    "Education": "शिक्षा",
    "Infrastructure": "पूर्वाधार",
    "Health": "स्वास्थ्य",
    "Water": "खानेपानी",
    "Electricity": "बिजुली",
    "Corruption": "भ्रष्टाचार",
    "Safety": "सुरक्षा",
    "Environment": "वातावरण",
    "Other": "अन्य",
}

# Category to ministry slug mapping
CATEGORY_MINISTRY = {
    "Education": "education",
    "Infrastructure": "infrastructure",
    "Health": "health",
    "Water": "energy-water",
    "Electricity": "energy-water",
    "Corruption": "ciaa",
    "Safety": "home-affairs",
    "Environment": "environment",
    "Other": "home-affairs",
}


def _get_groq_client():
    return Groq(api_key=os.environ["GROQ_API_KEY"])


@router.post("/classify")
def classify_complaint(payload: dict):
    """Classify a complaint using Groq Llama 3.3. Handles Nepali, Romanized Nepali, and English."""
    text = payload.get("text", "")
    if not text:
        return {"error": "No text provided"}

    client = _get_groq_client()

    prompt = f"""You are classifying Nepal government complaints for platform Sunuwa (सुनुवाइ).
The complaint can be in Nepali Devanagari, Romanized Nepali, or English. Understand all three.

Complaint: "{text}"

Return ONLY valid JSON with these exact keys. No extra text:
{{
  "category_en": "Education",
  "severity": 7,
  "summary_ne": "एक लाइनमा समस्याको सारांश नेपालीमा",
  "summary_en": "One line summary in English"
}}

Rules:
- category_en must be EXACTLY one of: Education, Infrastructure, Health, Water, Electricity, Corruption, Safety, Environment, Other
- severity is integer 1-10 (10 = most severe/urgent)
- summary_ne is one sentence in Nepali Devanagari script
- summary_en is one sentence in English"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=250,
        )
        result = json.loads(response.choices[0].message.content)
        result["category_ne"] = CATEGORIES_NE.get(result.get("category_en", "Other"), "अन्य")
        result["ministry_slug"] = CATEGORY_MINISTRY.get(result.get("category_en", "Other"), "home-affairs")
        return result
    except Exception as e:
        print(f"Classification error: {e}")
        return {
            "category_en": "Other",
            "category_ne": "अन्य",
            "severity": 5,
            "summary_ne": "उजुरी प्राप्त भयो।",
            "summary_en": "Complaint received.",
            "ministry_slug": "home-affairs",
        }


@router.post("/process-complaint")
async def process_complaint(payload: dict, background_tasks: BackgroundTasks):
    """Called after a complaint is saved to DB. Runs classify + embed + update asynchronously."""
    background_tasks.add_task(_do_process, payload.get("complaint_id"), payload.get("text", ""))
    return {"status": "processing"}


def _do_process(complaint_id: str, text: str):
    """Background task: classify + embed + update Supabase."""
    from supabase import create_client
    from routers.embed import get_embedding

    try:
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

        # Step 1: Classify
        classification = classify_complaint({"text": text})

        # Step 2: Embed
        embedding = get_embedding(text)

        # Step 3: Get ministry ID from slug
        ministry_slug = classification.get("ministry_slug", "home-affairs")
        ministry_res = db.table("ministries").select("id").eq("slug", ministry_slug).execute()
        ministry_id = ministry_res.data[0]["id"] if ministry_res.data else None

        # Step 4: Update complaint record
        db.table("complaints").update({
            "category_en": classification.get("category_en"),
            "category_ne": classification.get("category_ne"),
            "severity": classification.get("severity", 5),
            "summary_en": classification.get("summary_en", ""),
            "summary_ne": classification.get("summary_ne", ""),
            "embedding": embedding,
            "ministry_id": ministry_id,
            "status": "active",
        }).eq("id", complaint_id).execute()

        print(f"Processed complaint {complaint_id}: {classification.get('category_en')}")

    except Exception as e:
        print(f"Error processing complaint {complaint_id}: {e}")
        # Mark as failed so we can retry
        try:
            db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
            db.table("complaints").update({"status": "error"}).eq("id", complaint_id).execute()
        except Exception:
            pass
