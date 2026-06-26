from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import classify, embed, cluster, brief, news, escalation
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Sunuwa AI API", description="AI backend for Sunuwa civic intelligence platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classify.router, prefix="/api")
app.include_router(embed.router, prefix="/api")
app.include_router(cluster.router, prefix="/api")
app.include_router(brief.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(escalation.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok", "service": "sunuwa-api"}

@app.get("/")
def root():
    return {"message": "Sunuwa API is running", "docs": "/docs"}
