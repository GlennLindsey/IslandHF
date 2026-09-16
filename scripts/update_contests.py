#!/usr/bin/env python3
"""Update IslandHF contest data from the WA7BNM Contest Calendar RSS feed."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

RSS_URL = "https://www.contestcalendar.com/calendar.rss"
SOURCE_NAME = "WA7BNM Contest Calendar"
OUTPUT_FILE = Path(__file__).resolve().parents[1] / "data" / "contests.json"
USER_AGENT = "IslandHF/0.1 (Amateur Radio club website)"

# Examples supported:
#   0230Z-0300Z, Sep 16
#   0000Z-0100Z, Sep 17 and 0200Z-0300Z, Sep 18
#   1200Z, Sep 17 to 1200Z, Sep 18
RANGE_RE = re.compile(
    r"(?P<start>\d{4})Z(?:-(?P<end>\d{4})Z)?\s*,\s*"
    r"(?P<month>[A-Za-z]{3})\s+(?P<day>\d{1,2})"
)

# Same-date/time-to-time form is handled by RANGE_RE.
# Cross-date form: 1200Z, Sep 17 to 1200Z, Sep 18
CROSS_DATE_RE = re.compile(
    r"(?P<start>\d{4})Z\s*,\s*(?P<sm>[A-Za-z]{3})\s+(?P<sd>\d{1,2})\s+"
    r"to\s+(?P<end>\d{4})Z\s*,\s*(?P<em>[A-Za-z]{3})\s+(?P<ed>\d{1,2})",
    re.IGNORECASE,
)

MONTHS = {
    name: number
    for number, name in enumerate(
        [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ],
        start=1,
    )
}


def fetch_rss() -> bytes:
    request = Request(RSS_URL, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read()


def text(element: ET.Element | None) -> str:
    return (element.text or "").strip() if element is not None else ""


def choose_year(month: int, day: int, reference: datetime) -> int:
    """Choose the year closest to the RSS feed's build date."""
    candidates = [reference.year - 1, reference.year, reference.year + 1]
    target = [(datetime(y, month, day, tzinfo=timezone.utc), y) for y in candidates]
    return min(target, key=lambda item: abs(item[0] - reference))[1]


def make_utc(year: int, month_name: str, day: int, hhmm: str) -> datetime:
    month = MONTHS[month_name[:3].title()]
    hour = int(hhmm[:2])
    minute = int(hhmm[2:])

    # WA7BNM uses 2400Z to mean midnight at the end of the stated date.
    if hour == 24 and minute == 0:
        return datetime(year, month, day, 0, 0, tzinfo=timezone.utc) + timedelta(days=1)

    if hour > 23 or minute > 59:
        raise ValueError(f"Invalid contest time: {hhmm}Z")

    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def parse_sessions(description: str, reference: datetime) -> list[dict]:
    sessions: list[dict] = []

    # First handle explicit cross-date ranges so they aren't split into two
    # unrelated matches by RANGE_RE.
    consumed_spans: list[tuple[int, int]] = []
    for match in CROSS_DATE_RE.finditer(description):
        start_month = MONTHS[match.group("sm")[:3].title()]
        end_month = MONTHS[match.group("em")[:3].title()]
        start_year = choose_year(start_month, int(match.group("sd")), reference)
        end_year = choose_year(end_month, int(match.group("ed")), reference)

        start = make_utc(
            start_year, match.group("sm"), int(match.group("sd")), match.group("start")
        )
        end = make_utc(
            end_year, match.group("em"), int(match.group("ed")), match.group("end")
        )
        if end <= start:
            # Usually indicates a year boundary.
            end = end.replace(year=end.year + 1)

        sessions.append(
            {
                "startUTC": start.isoformat().replace("+00:00", "Z"),
                "endUTC": end.isoformat().replace("+00:00", "Z"),
            }
        )
        consumed_spans.append(match.span())

    # Handle normal forms such as 0230Z-0300Z, Sep 16.
    for match in RANGE_RE.finditer(description):
        if any(a <= match.start() < b for a, b in consumed_spans):
            continue

        month = MONTHS[match.group("month")[:3].title()]
        day = int(match.group("day"))
        year = choose_year(month, day, reference)
        start = make_utc(year, match.group("month"), day, match.group("start"))

        end_text = match.group("end") or match.group("start")
        end = make_utc(year, match.group("month"), day, end_text)

        # A contest may run across midnight even when the feed expresses it
        # with a single date. If the end clock time is earlier than the start,
        # move the end to the following day.
        if end < start:
            end = end.replace(day=end.day + 1)

        sessions.append(
            {
                "startUTC": start.isoformat().replace("+00:00", "Z"),
                "endUTC": end.isoformat().replace("+00:00", "Z"),
            }
        )

    sessions.sort(key=lambda item: item["startUTC"])
    return sessions


def main() -> int:
    try:
        xml_data = fetch_rss()
        root = ET.fromstring(xml_data)
    except Exception as exc:
        print(f"ERROR: could not fetch/parse {RSS_URL}: {exc}", file=sys.stderr)
        return 1

    channel = root.find("channel")
    if channel is None:
        print("ERROR: RSS channel not found", file=sys.stderr)
        return 1

    last_build = text(channel.find("lastBuildDate"))
    try:
        reference = parsedate_to_datetime(last_build).astimezone(timezone.utc)
    except Exception:
        reference = datetime.now(timezone.utc)

    contests = []
    for item in channel.findall("item"):
        name = text(item.find("title"))
        link = text(item.find("link"))
        description = text(item.find("description"))
        guid = text(item.find("guid"))
        sessions = parse_sessions(description, reference)

        contests.append(
            {
                "name": name,
                "description": description,
                "link": link,
                "guid": guid,
                "sessions": sessions,
            }
        )

    # Keep the RSS order; it is already chronological in the WA7BNM feed.
    output = {
        "source": SOURCE_NAME,
        "sourceURL": RSS_URL,
        "updatedUTC": reference.isoformat().replace("+00:00", "Z"),
        "contestCount": len(contests),
        "contests": contests,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"Updated: {OUTPUT_FILE}")
    print(f"Source:  {RSS_URL}")
    print(f"Contests: {len(contests)}")
    print(f"Feed:    {reference.isoformat()}")

    for contest in contests[:5]:
        first = contest["sessions"][0] if contest["sessions"] else None
        if first:
            print(f"  {contest['name']}: {first['startUTC']} -> {first['endUTC']}")
        else:
            print(f"  {contest['name']}: {contest['description']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
