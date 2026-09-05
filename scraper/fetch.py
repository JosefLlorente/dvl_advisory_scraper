from __future__ import annotations

import time
from typing import Any

import httpx
from bs4 import BeautifulSoup

from . import USER_AGENT
from .config import REQUEST_DELAY_SECONDS


def build_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en-PH,en;q=0.9"},
        follow_redirects=True,
        timeout=30.0,
    )


def fetch_html(client: httpx.Client, url: str, delay: bool = True) -> str:
    response = client.get(url)
    response.raise_for_status()
    if delay:
        time.sleep(REQUEST_DELAY_SECONDS)
    return response.text


def parse_post(html: str, source_url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one('h1[data-hook="post-title"], [data-hook="post-title"] h1')
    title = title_el.get_text(" ", strip=True) if title_el else ""

    body_el = soup.select_one('[data-hook="post-description"]')
    raw_html = str(body_el) if body_el else ""
    raw_text = ""
    if body_el:
        for sibling_label in ("Related Posts", "Latest News"):
            related = body_el.find(string=lambda value: value and sibling_label in value)
            if related:
                for leftover in list(related.find_all_next()):
                    leftover.decompose()
        raw_text = " ".join(body_el.get_text("\n", strip=True).split())

    published = soup.find("meta", attrs={"property": "article:published_time"})
    modified = soup.find("meta", attrs={"property": "article:modified_time"})
    categories = [
        " ".join(el.get_text(" ", strip=True).split())
        for el in soup.select('[data-hook="post-category-label"]')
    ]

    if not title:
        og = soup.find("meta", attrs={"property": "og:title"})
        title = og["content"].strip() if og and og.get("content") else source_url

    return {
        "source_url": source_url,
        "title": title,
        "raw_html": raw_html,
        "raw_text": raw_text,
        "published_at": published["content"] if published and published.get("content") else None,
        "modified_at": modified["content"] if modified and modified.get("content") else None,
        "categories": categories,
    }
