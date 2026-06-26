from fastapi import APIRouter
import google.generativeai as genai
import json
import os

router = APIRouter()


@router.post("/generate-brief/{ministry_slug}")
def generate_brief(ministry_slug: str):
    """Generate an AI minister intelligence brief in Nepali for the given ministry."""
    from supabase import create_client

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    # Get ministry
    ministry_res = db.table("ministries").select("*").eq("slug", ministry_slug).execute()
    if not ministry_res.data:
        return {"error": f"Ministry '{ministry_slug}' not found"}
    ministry = ministry_res.data[0]

    # Get top clusters for this ministry
    clusters_res = (
        db.table("clusters")
        .select("*, ward:wards(name_ne, municipality, district)")
        .eq("ministry_id", ministry["id"])
        .order("urgency_score", desc=True)
        .limit(10)
        .execute()
    )
    clusters = clusters_res.data or []

    # Get recent news
    news_res = db.table("news_items").select("title, source").limit(15).execute()
    news = news_res.data or []

    # Fall back to raw complaints when no clusters exist yet
    raw_complaints = []
    if not clusters:
        cat_to_slug = {
            "Education": "education", "Infrastructure": "infrastructure",
            "Health": "health", "Water": "energy-water", "Electricity": "energy-water",
            "Corruption": "ciaa", "Safety": "home-affairs", "Other": "home-affairs",
        }
        matching_cats = [cat for cat, slug in cat_to_slug.items() if slug == ministry_slug]
        comp_res = (
            db.table("complaints")
            .select("summary_ne, category_en, severity, ward:wards(name_ne, municipality)")
            .or_(f"ministry_id.eq.{ministry['id']},category_en.in.({','.join(matching_cats)})")
            .order("severity", desc=True)
            .limit(20)
            .execute()
        )
        raw_complaints = comp_res.data or []

    # Build prompt context from clusters or raw complaints
    if clusters:
        complaint_text = "\n".join([
            f"- {c.get('summary_ne', 'N/A')} ({c.get('complaint_count', 0)} उजुरी, urgency: {c.get('urgency_score', 0)})"
            for c in clusters
        ])
        total_complaints = sum(c.get("complaint_count", 0) for c in clusters)
    elif raw_complaints:
        complaint_text = "\n".join([
            f"- {c.get('summary_ne') or c.get('category_en', '')} (severity: {c.get('severity', 0)}, {(c.get('ward') or {}).get('municipality', '')})"
            for c in raw_complaints
        ])
        total_complaints = len(raw_complaints)
    else:
        complaint_text = "हाल कुनै उजुरी उपलब्ध छैन।"
        total_complaints = 0

    news_text = (
        "\n".join([f"- {n['title']} ({n['source']})" for n in news[:8]])
        if news
        else "कुनै समाचार उपलब्ध छैन।"
    )

    prompt_ne = f"""तपाईं नेपाल सरकारका लागि दैनिक खुफिया रिपोर्ट बनाउनुहुन्छ। सरकारी कागजात जस्तो औपचारिक र ठोस भाषा प्रयोग गर्नुहोस्।

मन्त्रालय: {ministry['name_ne']}
कुल उजुरी: {total_complaints}

नागरिक उजुरीहरू:
{complaint_text}

आजका मिडिया समाचार:
{news_text}

निम्न ढाँचामा नेपालीमा रिपोर्ट बनाउनुहोस्। प्रत्येक खण्ड ## ले सुरु गर्नुहोस्:

## Current Situation
(२ वाक्यमा आजको मुख्य अवस्था — ठोस संख्यासहित)

## Emerging Risks
(बुलेट पोइन्टमा — सबैभन्दा जोखिमपूर्ण समस्याहरू)

## Affected Areas
(कुन नगरपालिका/वडामा धेरै उजुरी)

## Recommended Actions
(२-३ ठोस, कार्यान्वयनयोग्य कदम)

## Predicted Escalations
(कुन उजुरीहरू SLA उल्लंघन गर्ने सम्भावना)"""

    prompt_en = f"""You are generating a daily intelligence brief for Nepal Government officials.
Use formal, concise language suitable for a government document.

Ministry: {ministry['name']}
Total complaints: {total_complaints}

Citizen complaints:
{complaint_text}

Today's media signals:
{news_text}

Write the brief using this exact structure (each section starts with ##):

## Current Situation
(2 sentences — current state with specific numbers)

## Emerging Risks
(bullet points — most urgent issues)

## Affected Areas
(which municipalities/wards have highest volume)

## Recommended Actions
(2-3 concrete, actionable steps)

## Predicted Escalations
(which cases will breach SLA deadlines)"""

    try:
        gemini = genai.GenerativeModel("gemini-1.5-flash")
        resp_ne = gemini.generate_content(prompt_ne)
        brief_ne = resp_ne.text
        resp_en = gemini.generate_content(prompt_en)
        brief_en = resp_en.text
    except Exception as e:
        print(f"Gemini error: {e}")
        brief_ne = f"## Current Situation\n{ministry['name_ne']} अन्तर्गत {total_complaints} उजुरी प्राप्त भएका छन्।\n\n## Emerging Risks\n{complaint_text}"
        brief_en = f"## Current Situation\n{total_complaints} complaints received under {ministry['name']}.\n\n## Emerging Risks\n{complaint_text}"

    # Save to DB
    db.table("briefs").insert({
        "ministry_id": ministry["id"],
        "content_ne": brief_ne,
        "content_en": brief_en,
    }).execute()

    return {
        "status": "generated",
        "ministry": ministry_slug,
        "total_complaints": total_complaints,
        "clusters_analyzed": len(clusters),
        "languages": ["ne", "en"],
    }


@router.get("/latest-brief/{ministry_slug}")
def get_latest_brief(ministry_slug: str):
    """Get the most recently generated brief for a ministry."""
    from supabase import create_client

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    ministry_res = db.table("ministries").select("id").eq("slug", ministry_slug).execute()
    if not ministry_res.data:
        return {"error": "Ministry not found"}

    ministry_id = ministry_res.data[0]["id"]

    brief_res = (
        db.table("briefs")
        .select("*")
        .eq("ministry_id", ministry_id)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )

    if not brief_res.data:
        return {"brief": None, "message": "No brief generated yet"}

    return {"brief": brief_res.data[0]}
