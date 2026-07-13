"""Конвейер «Библиотека» — ISKCON ONE LOVE.

Стадии:
  0  rights    ворота прав (LEGAL.md §2.3)
  1  discover  поиск книг в открытых корпусах
  2  parse     оригинал → канонический JSONL
  3  translate перевод в стандарте BBT (→ draft)
  4  load      запись в D1 + связь с личностями
  5  gate      У5-ворота (Б001–Б008)
"""
__all__ = ["registry", "d1", "rights", "discover", "parse", "translate", "load", "gate"]
