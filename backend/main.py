from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

app = FastAPI()

# React 개발서버에서 요청 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "scores.json"

def load_scores():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_scores(scores):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)


class ScoreEntry(BaseModel):
    nickname: str
    score: int
    time: float


@app.get("/leaderboard")
def get_leaderboard():
    scores = load_scores()
    return scores[:20]


@app.post("/score")
def post_score(entry: ScoreEntry):
    scores = load_scores()

    # 닉네임 중복 체크
    existing = [s for s in scores if s["nickname"] == entry.nickname.strip()]
    if existing:
        return {"error": "이미 존재하는 닉네임이에요!", "duplicate": True}

    scores.append(entry.model_dump())
    scores.sort(key=lambda x: x["score"], reverse=True)
    save_scores(scores)
    rank = next(i+1 for i, s in enumerate(scores) if s["nickname"] == entry.nickname)
    return {"rank": rank, "total": len(scores), "duplicate": False}