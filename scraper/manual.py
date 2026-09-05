from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .parse import parse_advisory

FRONT_MATTER = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)


def parse_manual_file(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    match = FRONT_MATTER.match(text)
    if not match:
        raise ValueError(f"{path.name} needs YAML front matter with source_url")

    meta: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip()

    source_url = meta.get("source_url")
    if not source_url:
        raise ValueError(f"{path.name} is missing source_url")

    body = match.group(2).strip()
    title = meta.get("title") or path.stem.replace("-", " ")
    parsed = parse_advisory(
        title=title,
        raw_text=body,
        source_url=source_url,
        published_at=meta.get("published_at"),
        parse_confidence="manual",
    )
    if meta.get("type"):
        parsed["type"] = meta["type"]
    return {
        "source_url": source_url,
        "title": title,
        "raw_html": None,
        "raw_text": body,
        "published_at": meta.get("published_at"),
        "parsed": parsed,
    }
