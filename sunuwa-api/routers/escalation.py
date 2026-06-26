"""
Auto-escalation background job for Sunuwa.

SLA rules (from CLAUDE.md):
  Health/Safety:      2 days  → ward → municipality
  Infrastructure:     7 days  → ward → municipality
  Administrative:    14 days  → ward → municipality
  After municipality: 2× SLA → municipality → ministry

Call POST /api/run-escalation from a cron job (e.g. cron-job.org) every hour.
"""

from fastapi import APIRouter, BackgroundTasks
from datetime import datetime, timezone
import os

router = APIRouter()

# SLA days per category at each level
LEVEL_SLA: dict[str, dict[int, int]] = {
    "Health":         {1: 2,  2: 4,  3: 8},
    "Safety":         {1: 2,  2: 4,  3: 8},
    "Electricity":    {1: 3,  2: 6,  3: 12},
    "Water":          {1: 3,  2: 6,  3: 12},
    "Infrastructure": {1: 7,  2: 14, 3: 28},
    "Environment":    {1: 7,  2: 14, 3: 28},
    "Education":      {1: 7,  2: 14, 3: 28},
    "Corruption":     {1: 5,  2: 10, 3: 20},
    "Other":          {1: 7,  2: 14, 3: 28},
}


@router.post("/run-escalation")
async def trigger_escalation(background_tasks: BackgroundTasks):
    """Trigger escalation check in background. Call via cron every hour."""
    background_tasks.add_task(_run_escalation)
    return {"status": "escalation started"}


@router.get("/escalation-status")
def escalation_status():
    """Returns count of complaints at each escalation level."""
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    res = db.table("complaints").select("escalation_level").neq("status", "resolved").execute()
    counts = {1: 0, 2: 0, 3: 0, 4: 0}
    for row in (res.data or []):
        lvl = row.get("escalation_level", 1)
        counts[min(lvl, 4)] = counts.get(min(lvl, 4), 0) + 1
    return {
        "ward":         counts[1],
        "municipality": counts[2],
        "province":     counts[3],
        "ministry":     counts[4],
        "total_active": sum(counts.values()),
    }


def _run_escalation():
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    # Fetch all active/pending complaints not yet at ministry level
    res = db.table("complaints") \
        .select("id, category_en, escalation_level, created_at, status, ward_id") \
        .neq("status", "resolved") \
        .lt("escalation_level", 4) \
        .execute()

    complaints = res.data or []
    now = datetime.now(timezone.utc)
    escalated = 0

    for c in complaints:
        cat   = c.get("category_en") or "Other"
        level = c.get("escalation_level") or 1
        sla   = LEVEL_SLA.get(cat, LEVEL_SLA["Other"]).get(level, 7)

        created_at_str = c.get("created_at", "")
        try:
            created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        except Exception:
            continue

        age_days = (now - created_at).total_seconds() / 86400

        if age_days >= sla:
            new_level = min(level + 1, 4)
            db.table("complaints").update({
                "escalation_level": new_level,
                "updated_at": now.isoformat(),
            }).eq("id", c["id"]).execute()
            escalated += 1
            print(f"Escalated complaint {c['id']}: level {level} → {new_level} (age {age_days:.1f}d, SLA {sla}d, cat {cat})")

    print(f"Escalation run complete: {escalated}/{len(complaints)} complaints escalated")
