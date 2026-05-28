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
import os
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph


# ---------- state ----------
class GameState(TypedDict, total=False):
    image_url: str
    target_desc: str | None
    target_elements: list[str]
    attempt_text: str
    attempt_number: int   # 1..3
    max_attempts: int     # 3
    # outputs
    score: int
    solved: bool
    missing_elements: list[str]
    grammar_errors: list[dict]
    hint: str
    reveal: str | None


# ---------- LLMs ----------
def _vision_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini"),
        temperature=0.2,
    )


def _text_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.0,
    )


# ---------- nodes ----------
_DESCRIBE_SYSTEM = (
    "You are a Mandarin teacher building a description target for a guessing "
    "game. Look at the image and respond with strict JSON:\n"
    '{ "description_zh": "<2-4 short Simplified-Chinese sentences describing '
    'the scene at HSK4 level>", "elements": ["<key visible element 1>", '
    '"<key visible element 2>", "..."] }\n'
    "Elements should be 4-7 concise English noun phrases (subject, action, "
    "setting, notable details). Output ONLY the JSON."
)


def describe_image(state: GameState) -> GameState:
    if state.get("target_desc"):
        return {
            "target_desc": state["target_desc"],
            "target_elements": state.get("target_elements") or [],
        }
        
    msgs = [
        SystemMessage(content=_DESCRIBE_SYSTEM),
        HumanMessage(
            content=[
                {"type": "text", "text": "Describe this image for the game."},
                {"type": "image_url", "image_url": {"url": state["image_url"]}},
            ]
        ),
    ]
    raw = _vision_llm().invoke(msgs).content
    data = _safe_json(raw)
    return {
        "target_desc": data.get("description_zh", ""),
        "target_elements": data.get("elements", []),
    }


_GRADE_SYSTEM = (
    "You are a strict but kind Mandarin grader for an image-description "
    "guessing game. You will receive: (a) the target Chinese description, "
    "(b) the key visible elements, (c) the learner's Chinese attempt, "
    "(d) attempt number out of max attempts.\n\n"
    "Grade their attempt and respond with STRICT JSON:\n"
    "{\n"
    '  "score": <0-100 integer>,\n'
    '  "solved": <true if score >= 60 AND >=55% of elements covered>,\n'
    '  "missing_elements": [<english element strings they failed to mention>],\n'
    '  "grammar_errors": [\n'
    '     {"wrong": "<their phrase>", "correct": "<fixed phrase>", '
    '"explanation": "<english 1-sentence reason>"}\n'
    "  ],\n"
    '  "hint": "<english coaching note; on attempt 1 stay vague; on attempt 2 '
    "mention 1-2 specific missing elements without giving the full sentence; "
    'on the last attempt give the full reveal in reveal>",\n'
    '  "reveal": "<full Chinese target on the last attempt_number OR when '
    'solved; otherwise null>"\n'
    "}\n"
    "Output ONLY the JSON."
)


def grade_attempt(state: GameState) -> GameState:
    payload = {
        "target_description_zh": state.get("target_desc", ""),
        "target_elements": state.get("target_elements", []),
        "learner_attempt_zh": state.get("attempt_text", ""),
        "attempt_number": state.get("attempt_number", 1),
        "max_attempts": state.get("max_attempts", 3),
    }
    msgs = [
        SystemMessage(content=_GRADE_SYSTEM),
        HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
    ]
    raw = _text_llm().invoke(msgs).content
    data = _safe_json(raw)
    # safety: force reveal on last attempt
    if state.get("attempt_number", 1) >= state.get("max_attempts", 3):
        data.setdefault("reveal", state.get("target_desc"))
    return {
        "score": int(data.get("score", 0)),
        "solved": bool(data.get("solved", False)),
        "missing_elements": list(data.get("missing_elements", []) or []),
        "grammar_errors": list(data.get("grammar_errors", []) or []),
        "hint": str(data.get("hint", "") or ""),
        "reveal": data.get("reveal"),
    }


def _safe_json(raw: str) -> dict:
    """Strip code fences if the model wrapped output."""
    if isinstance(raw, list):
        raw = "".join(p.get("text", "") for p in raw if isinstance(p, dict))
    raw = (raw or "").strip()
    if raw.startswith("```"):
        # remove first and last fence
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].lstrip()
    try:
        return json.loads(raw)
    except Exception:
        # try to extract a JSON object
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except Exception:
                pass
    return {}


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
) -> dict:
    """Run one grading turn; returns the merged final state as a plain dict."""
    init: GameState = {
        "image_url": image_url,
        "attempt_text": attempt_text,
        "attempt_number": attempt_number,
        "max_attempts": max_attempts,
        "target_desc": target_desc,
        "target_elements": target_elements or [],
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
        "target_desc": out.get("target_desc"),
        "target_elements": out.get("target_elements", []),
    }
