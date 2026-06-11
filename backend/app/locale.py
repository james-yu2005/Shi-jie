"""Shared locale/script labels for AI prompts."""

from __future__ import annotations


def script_label(script: str) -> str:
    if script == "traditional":
        return "Traditional Chinese"
    return "Simplified Chinese"


def locale_label(locale: str) -> str:
    if locale == "cantonese":
        return "Cantonese"
    return "Mandarin"


def tutor_role(locale: str) -> str:
    if locale == "cantonese":
        return "Cantonese tutor"
    return "Mandarin tutor"


def romanization_note(locale: str) -> str:
    if locale == "cantonese":
        return "Use Jyutping for romanization in examples when possible."
    return "Use Pinyin with tone marks in examples."
