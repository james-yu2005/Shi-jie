"""LangGraph agent for the Daily Image game.

State flow (LangGraph):
    [start] -> describe_image (only if target description missing)
            -> grade_attempt -> [end]

describe_image: GPT-4o-mini vision derives a short target description
    (Chinese + key elements list) of the image. Cached on the DailyGame
    row so subsequent attempts re-use the same target.

grade_attempt: compares the user's Chinese sentence against the target
    and returns structured JSON with:
        - score (0-100)
        - solved (bool)
        - missing_elements: list[str]
        - grammar_errors: list[{wrong, correct, explanation}]
        - hint: str           (shown after attempt; depth increases)
        - reveal: str | None  (full Chinese model answer once revealed)
"""
from __future__ import annotations

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from ..llm import safe_json, text_llm, vision_llm
from .. import dictionary as dct
from ..locale import locale_label, script_label, tutor_role

# ---------- state ----------
class GameState(TypedDict, total=False):
    image_url: str
    target_desc: str | None
    target_elements: list[str]
    attempt_text: str
    attempt_number: int   # 1..3
    max_attempts: int     # 3
    difficulty: str       # "easy" | "medium" | "hard"
    script: str
    locale: str
    # outputs
    score: int
    solved: bool
    missing_elements: list[str]
    grammar_errors: list[dict]
    hint: str
    reveal: str | None
    vocab_hints: list[dict]

# ---------- difficulty level -----
_DIFFICULTY_RULES = {
    "easy": (
        "Difficulty: EASY. Be lenient and encouraging. Accept paraphrases, synonyms, and" 
        "alternative sentence structures whenever they communicate the same meaning as the"
        "target answer. Mark solved if the score >= 45 and the learner covered ~35% of" 
        "the key elements. Overlook minor grammar slips."
    ),
    "medium": (
        "Difficulty: MEDIUM. Use standard grading. Accept paraphrases, synonyms, and" 
        "alternative sentence structures whenever they communicate the same meaning as the"
        "target answer. Mark solved if the score >= 60 and the learner covered ~45 % of" 
        "the key elements."
    ),
    "hard": (
        "Difficulty: MEDIUM. Use strict grading. Accept paraphrases, synonyms, and" 
        "alternative sentence structures whenever they communicate the same meaning as the"
        "target answer. Mark solved if the score >= 75 and the learner covered ~60 % of" 
        "the key elements."
    ),
}

# ---------- nodes ----------
def _describe_system(script: str, locale: str) -> str:
    script_name = script_label(script)
    return (
        f"You are a {tutor_role(locale)} building a description target for a guessing "
        "game. Look at the image and respond with strict JSON:\n"
        f'{{ "description_zh": "<1-2 short {script_name} sentences describing'
        ' the main scene>", "elements": ["<main element 1>", "<main element 2>"] }\n'
        "Focus on the BIG picture only — what is this place/thing and what stands "
        "out at a glance (e.g. restaurant, chairs, wooden furniture). "
        "Use 2-3 elements max: main subject, setting/type, and at most one obvious "
        "detail. Do NOT list decorative or secondary details (lighting style, "
        "glassware, window size, interior design adjectives) unless they are the "
        "clear focal point of the image. Output ONLY the JSON."
    )

def describe_image(state: GameState) -> GameState:
    if state.get("target_desc"):
        return {
            "target_desc": state["target_desc"],
            "target_elements": state.get("target_elements") or [],
        }

    script = state.get("script", "simplified")
    locale = state.get("locale", "mandarin")
    msgs = [
        SystemMessage(content=_describe_system(script, locale)),
        HumanMessage(
            content=[
                {"type": "text", "text": "Describe this image for the game."},
                {"type": "image_url", "image_url": {"url": state["image_url"]}},
            ]
        ),
    ]
    raw = vision_llm(0.2).invoke(msgs).content
    data = safe_json(raw)
    return {
        "target_desc": data.get("description_zh", ""),
        "target_elements": data.get("elements", []),
    }


def _grade_system(difficulty: str, locale: str) -> str:
    rules = _DIFFICULTY_RULES.get(difficulty, _DIFFICULTY_RULES["easy"])
    lang = locale_label(locale)
    return (
        f"You are a strict but kind {lang} grader for an image-description "
        "guessing game. You will receive: (a) the target Chinese description, "
        "(b) the key visible elements, (c) the learner's Chinese attempt, "
        "(d) attempt number out of max attempts.\n\n"
        f"{rules}\n\n"
        "Grade their attempt and respond with STRICT JSON:\n"
        "{\n"
        '  "score": <0-100 integer>,\n'
        '  "solved": <true per the difficulty rule above>,\n'
        '  "missing_elements": [<only MAIN target elements they failed to mention; '
        'omit decorative/secondary details>],\n'
        '  "grammar_errors": [\n'
        '     {"wrong": "<their phrase>", "correct": "<fixed phrase>", '
        '"explanation": "<english 1-sentence reason>"}\n'
        "  ],\n"
        '  "hint": "<english coaching note; on attempt 1 stay vague; on attempt 2 '
        "mention 2-3 specific missing elements without giving the full sentence; "
        'on the last attempt give the full reveal in reveal>",\n'
        '  "reveal": "<full Chinese target on the last attempt_number OR when '
        'solved; otherwise null>"\n'
        "}\n"
        "Output ONLY the JSON."
    )


def _extract_vocab_hints(
    target_desc: str | None,
    attempt_num: int,
    max_attempts: int,
    locale: str = "mandarin",
) -> list[dict]:
    """Extract 1-2 vocabulary words from target description to help learner.
    
    Attempt 1: 1 word, Attempt 2: 1-2 more words, Final attempt: none (show reveal instead)
    """
    if not target_desc or attempt_num >= max_attempts:
        return []
    
    # Segment the target description
    words = dct.segment(target_desc)
    # Keep only words with dictionary entries (actual vocab, not particles)
    vocab_candidates = []
    for w in words:
        if not any(dct.is_hanzi(c) for c in w):
            continue
        entries = dct.lookup(w)
        if entries and len(w) >= 2:  # multi-character words only
            vocab_candidates.append((w, entries[0]))
    
    if not vocab_candidates:
        return []
    
    # For attempt 1, give 1 word; attempt 2, give 1-2 more words
    count = 1 if attempt_num == 1 else min(2, len(vocab_candidates))
    # Offset by previous attempts to avoid repeating
    start_idx = (attempt_num - 1)
    hints = []
    for i in range(start_idx, min(start_idx + count, len(vocab_candidates))):
        if i >= len(vocab_candidates):
            break
        word, entry = vocab_candidates[i]
        hints.append({
            "hanzi": word,
            "pinyin": dct.romanization_for(entry, "mandarin"),
            "jyutping": entry.jyutping or "",
            "definition": "; ".join(entry.definitions[:2]),  # first 2 definitions
        })
    
    return hints


def grade_attempt(state: GameState) -> GameState:
    payload = {
        "target_description_zh": state.get("target_desc", ""),
        "target_elements": state.get("target_elements", []),
        "learner_attempt_zh": state.get("attempt_text", ""),
        "attempt_number": state.get("attempt_number", 1),
        "max_attempts": state.get("max_attempts", 3),
    }
    msgs = [
        SystemMessage(content=_grade_system(state.get("difficulty", "easy"), state.get("locale", "mandarin"))),
        HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
    ]
    raw = text_llm(0.0).invoke(msgs).content
    data = safe_json(raw)
    # safety: force reveal on last attempt
    if state.get("attempt_number", 1) >= state.get("max_attempts", 3):
        data.setdefault("reveal", state.get("target_desc"))
    
    # Extract vocabulary hints to help learner
    vocab_hints = _extract_vocab_hints(
        state.get("target_desc"),
        state.get("attempt_number", 1),
        state.get("max_attempts", 3),
        state.get("locale", "mandarin"),
    )
    
    return {
        "score": int(data.get("score", 0)),
        "solved": bool(data.get("solved", False)),
        "missing_elements": list(data.get("missing_elements", []) or []),
        "grammar_errors": list(data.get("grammar_errors", []) or []),
        "hint": str(data.get("hint", "") or ""),
        "reveal": data.get("reveal"),
        "vocab_hints": vocab_hints,
    }


# ---------- graph ----------
def _build_graph():
    g = StateGraph(GameState)
    g.add_node("describe_image", describe_image)
    g.add_node("grade_attempt", grade_attempt)
    g.add_edge(START, "describe_image")
    g.add_edge("describe_image", "grade_attempt")
    g.add_edge("grade_attempt", END)
    return g.compile()

_GRAPH = None

def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    return _GRAPH

def run(
    *,
    image_url: str,
    attempt_text: str,
    attempt_number: int,
    target_desc: str | None,
    target_elements: list[str] | None,
    max_attempts: int = 3,
    difficulty: str = "easy",
    script: str = "simplified",
    locale: str = "mandarin",
) -> dict:
    """Run one grading turn; returns the merged final state as a plain dict."""
    init: GameState = {
        "image_url": image_url,
        "attempt_text": attempt_text,
        "attempt_number": attempt_number,
        "max_attempts": max_attempts,
        "target_desc": target_desc,
        "target_elements": target_elements or [],
        "difficulty": difficulty,
        "script": script,
        "locale": locale,
    }
    out = get_graph().invoke(init)
    # Surface the cached/derived target so the caller can persist it.
    return {
        "score": out.get("score", 0),
        "solved": out.get("solved", False),
        "missing_elements": out.get("missing_elements", []),
        "grammar_errors": out.get("grammar_errors", []),
        "hint": out.get("hint", ""),
        "reveal": out.get("reveal"),
        "vocab_hints": out.get("vocab_hints", []),
        "target_desc": out.get("target_desc"),
        "target_elements": out.get("target_elements", []),
    }
