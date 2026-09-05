from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .keywords import is_relevant_title


def _normalize_url(href: str) -> str:
    url = urljoin("https://www.davaolight.com", href.split("?")[0])
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    return f"https://www.davaolight.com{path}"


def discover_posts(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    seen: dict[str, dict] = {}

    for link in soup.select('a[href*="/post/"]'):
        href = link.get("href")
        if not href or "/post/" not in href:
            continue
        if any(part in href for part in ("/feed", "static.parastorage")):
            continue

        url = _normalize_url(href)
        title_el = (
            link.find(attrs={"data-hook": "post-list-item__title"})
            or link.find(attrs={"data-hook": "post-title"})
            or link.find(["h1", "h2", "h3"])
        )
        title = " ".join((title_el or link).get_text(" ", strip=True).split())
        if not title or url in seen:
            continue
        if not is_relevant_title(title):
            continue
        seen[url] = {"source_url": url, "title": title}

    return list(seen.values())
