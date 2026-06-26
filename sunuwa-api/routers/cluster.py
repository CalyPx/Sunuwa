from fastapi import APIRouter, BackgroundTasks
import os

router = APIRouter()


@router.post("/run-clustering")
async def trigger_clustering(background_tasks: BackgroundTasks):
    """Trigger the full HDBSCAN clustering pipeline in the background. Call this via cron-job.org every 30 min."""
    background_tasks.add_task(_run)
    return {"status": "clustering started"}


def _run():
    from services.cluster_service import run_full_clustering
    result = run_full_clustering()
    print(f"Clustering result: {result}")
