"""
HDBSCAN Clustering Service
Pipeline: Load embeddings → UMAP reduction → HDBSCAN → Gemini summarize → Save to Supabase

Runs every 30 minutes via cron-job.org trigger on /api/run-clustering
"""

import numpy as np
import os
import json
import google.generativeai as genai
from supabase import create_client


def run_full_clustering() -> dict:
    """
    Full clustering pipeline. Fetches last 7 days of active complaints,
    runs UMAP + HDBSCAN, generates Gemini summaries, saves clusters to Supabase.
    """
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    # Fetch active complaints with embeddings from last 7 days
    result = (
        db.table("complaints")
        .select("id, text, category_en, category_ne, severity, ward_id, ministry_id, embedding, created_at")
        .eq("status", "active")
        .not_.is_("embedding", "null")
        .execute()
    )
    complaints = result.data or []

    if len(complaints) < 5:
        return {"status": "not_enough_data", "count": len(complaints), "required": 5}

    print(f"Clustering {len(complaints)} complaints...")

    # Extract embeddings as numpy array
    embeddings = np.array([c["embedding"] for c in complaints], dtype=np.float32)

    # UMAP dimensionality reduction
    # Reduces 384-dim embeddings to 5-dim for better HDBSCAN performance
    import umap
    n_neighbors = min(15, len(complaints) - 1)
    n_components = min(5, len(complaints) - 2)

    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
        low_memory=False,
    )
    reduced = reducer.fit_transform(embeddings)
    print(f"UMAP done. Shape: {reduced.shape}")

    # HDBSCAN clustering
    # min_cluster_size=3 means need at least 3 similar complaints to form a cluster
    import hdbscan
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=3,
        min_samples=2,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    labels = clusterer.fit_predict(reduced)

    # Group complaints by cluster label
    # label == -1 means noise (not part of any cluster) — SKIP these
    clusters_map = {}
    for idx, label in enumerate(labels):
        if label == -1:
            continue
        if label not in clusters_map:
            clusters_map[label] = []
        clusters_map[label].append(complaints[idx])

    print(f"Found {len(clusters_map)} clusters. Noise points: {sum(1 for l in labels if l == -1)}")

    if not clusters_map:
        return {"status": "no_clusters_found", "noise_count": sum(1 for l in labels if l == -1)}

    # Clear old clusters
    db.table("clusters").delete().neq("id", 0).execute()

    clusters_created = 0
    gemini = genai.GenerativeModel("gemini-1.5-flash")

    for label, cluster_complaints in clusters_map.items():
        # Take up to 20 complaints for Gemini summarization
        sample = cluster_complaints[:20]
        texts = [c["text"] for c in sample]

        # Determine dominant category (most common in this cluster)
        categories = [c.get("category_en", "Other") for c in cluster_complaints]
        category_en = max(set(categories), key=categories.count)

        categories_ne = [c.get("category_ne", "अन्य") for c in cluster_complaints]
        category_ne = max(set(categories_ne), key=categories_ne.count)

        # Most common ward
        ward_ids = [c["ward_id"] for c in cluster_complaints if c.get("ward_id")]
        ward_id = max(set(ward_ids), key=ward_ids.count) if ward_ids else None

        # Most common ministry
        ministry_ids = [c["ministry_id"] for c in cluster_complaints if c.get("ministry_id")]
        ministry_id = max(set(ministry_ids), key=ministry_ids.count) if ministry_ids else None

        avg_severity = sum(c.get("severity") or 5 for c in cluster_complaints) / len(cluster_complaints)
        complaint_count = len(cluster_complaints)

        # Urgency score formula:
        # complaint_count * 1.0 + avg_severity * 5.0
        # (news cross-reference will be added by escalation updater later)
        urgency_score = complaint_count * 1.0 + avg_severity * 5.0

        # Escalation level
        if urgency_score > 90:
            escalation_level = 4  # Federal Ministry
        elif urgency_score > 60:
            escalation_level = 3  # Province
        elif urgency_score > 30:
            escalation_level = 2  # Municipality
        else:
            escalation_level = 1  # Ward

        # Get ward lat/lng for map
        lat, lng = None, None
        if ward_id:
            ward_res = db.table("wards").select("lat, lng").eq("id", ward_id).execute()
            if ward_res.data:
                lat = ward_res.data[0]["lat"]
                lng = ward_res.data[0]["lng"]

        # Generate Nepali summary with Gemini
        prompt = f"""तपाईंले नेपाल सरकारको प्लेटफर्म सुनुवाइका लागि नागरिक उजुरीहरूको सारांश बनाउनु पर्छ।
यी {complaint_count} उजुरीहरूको विषयवस्तु: {category_ne}

उजुरीहरू (नमुना):
{chr(10).join(f'- {t[:200]}' for t in texts[:10])}

एक वाक्यमा मुख्य समस्या बताउनुहोस्। JSON मात्र फिर्ता गर्नुहोस्:
{{"summary_ne": "नेपालीमा एक वाक्य", "summary_en": "One sentence in English"}}"""

        try:
            response = gemini.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            summaries = json.loads(response.text)
        except Exception as e:
            print(f"Gemini error for cluster {label}: {e}")
            summaries = {
                "summary_ne": f"{category_ne} सम्बन्धी {complaint_count} उजुरी प्राप्त भएका छन्।",
                "summary_en": f"{complaint_count} complaints about {category_en} received.",
            }

        # Save cluster to Supabase
        db.table("clusters").insert({
            "category_en": category_en,
            "category_ne": category_ne,
            "ward_id": ward_id,
            "ministry_id": ministry_id,
            "complaint_count": complaint_count,
            "avg_severity": round(avg_severity, 1),
            "summary_ne": summaries.get("summary_ne"),
            "summary_en": summaries.get("summary_en"),
            "escalation_level": escalation_level,
            "urgency_score": round(urgency_score, 1),
            "lat": lat,
            "lng": lng,
        }).execute()

        # Update complaints to reference their cluster
        complaint_ids = [c["id"] for c in cluster_complaints]
        db.table("complaints").update({"cluster_id": clusters_created + 1}).in_("id", complaint_ids).execute()

        clusters_created += 1

    return {
        "status": "done",
        "total_complaints": len(complaints),
        "clusters_created": clusters_created,
        "noise_count": sum(1 for l in labels if l == -1),
    }
