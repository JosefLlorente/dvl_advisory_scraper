import re

TITLE_KEYWORDS = (
    "ADVISORY",
    "UPDATE",
    "UPDATED",
    "SCHEDULED",
    "EMERGENCY",
    "SWITCHING",
    "INTERRUPTION",
    "INTERRUPTIONS",
    "CANCELLED",
    "CANCELED",
    "POWER",
    "BROWNOUT",
)

_KEYWORD_RE = re.compile(
    r"\b(" + "|".join(re.escape(keyword) for keyword in TITLE_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


def is_relevant_title(title: str) -> bool:
    if not title:
        return False
    if "invitation to bid" in title.lower():
        return False
    return bool(_KEYWORD_RE.search(title))
