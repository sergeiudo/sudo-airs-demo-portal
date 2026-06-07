#!/usr/bin/env python3
"""
AIRS Release Notes -> Slack Notifier

Palo Alto retired the per-pillar "Features Introduced" pages (mid-2026) and now
publishes a single by-date feed at:
    /ai-runtime-security/new-features/by-date/prisma-airs/{month-year}
The legacy "features-introduced" URL 301-redirects to the latest month, which we
follow to discover "latest" reliably.

This script scrapes the latest month's features (plus a little prior-month context),
diffs against the last posted state (hash), shows a preview, and posts a rich Slack
message on confirmation.

Usage:
  python3 airs-slack-notify.py            # diff check + preview + interactive confirm
  python3 airs-slack-notify.py --yes      # diff check + post automatically (for cron)
  python3 airs-slack-notify.py --force    # skip diff, always post
"""

import re
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# -- Config ----------------------------------------------------------------------
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
STATE_FILE = Path(__file__).parent / "airs-docs-pdfs" / ".last-seen.json"

LEGACY_URL  = "https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced"
BYDATE_BASE = "https://docs.paloaltonetworks.com/ai-runtime-security/new-features/by-date/prisma-airs"
INDEX_URL   = BYDATE_BASE
KNOWN_ISSUES_URL     = "https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/known-issues"
ADDRESSED_ISSUES_URL = "https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/addressed-issues"

MONTHS = ["january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"]
EARLIER_MONTHS = 2  # how many prior months to surface as context


# -- Scraping --------------------------------------------------------------------

def get(url):
    return requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"}, allow_redirects=True)


def collapse(text):
    return " ".join((text or "").split())


def prettify_category(slug):
    if not slug:
        return "General"
    acr = {"ai": "AI", "api": "API", "ml": "ML", "llm": "LLM", "mcp": "MCP", "rag": "RAG"}
    return " ".join(acr.get(w.lower(), w.capitalize()) for w in slug.split("-"))


def label_from_slug(slug):
    m = re.match(r"^([a-z]+)-(\d{4})$", slug, re.I)
    if not m:
        return slug
    return m.group(1).capitalize() + " " + m.group(2)


def parse_month_features(soup):
    """Extract feature cards from a by-date month page."""
    features = []
    for card in soup.select("div.coveo-results-card"):
        title_el = card.select_one(".coveo-results-title")
        if not title_el:
            continue
        title = collapse(title_el.get_text())
        if len(title) < 4:
            continue

        rd = card.select_one(".coveo-results-release-date")
        lu = card.select_one(".coveo-results-last-update")
        release = collapse(rd.get_text()).replace("Release Date:", "").strip() if rd else ""
        updated = collapse(lu.get_text()).replace("Last Updated:", "").strip() if lu else ""

        # Category from the tag-group filter anchor (productSubCategoryTags=...%2F{slug}).
        category = "General"
        a = card.select_one(".coveo-results-tag-group a[href]")
        if a and a.has_attr("href"):
            m = re.search(r"productSubCategoryTags=[^&]*%2F([a-z0-9-]+)", a["href"], re.I)
            if m:
                category = prettify_category(unquote(m.group(1)))

        # Description: first meaningful paragraph in the excerpts block.
        summary = ""
        exc = card.select_one(".coveo-results-content-excerpts")
        if exc:
            for p in exc.find_all("p"):
                txt = collapse(p.get_text())
                if len(txt) > 25:
                    summary = txt
                    break

        features.append({
            "title": title, "category": category,
            "release": release, "updated": updated, "summary": summary,
        })
    return features


def discover_latest():
    """Follow the legacy redirect to the latest month; return (slug, url, features)."""
    r = get(LEGACY_URL)
    r.raise_for_status()
    final = r.url.rstrip("/")
    slug = final.split("/")[-1]
    return slug, final, parse_month_features(BeautifulSoup(r.text, "html.parser"))


def walk_back(latest_slug, max_months=EARLIER_MONTHS):
    """Fetch up to max_months prior months for context."""
    months = []
    m = re.match(r"^([a-z]+)-(\d{4})$", latest_slug, re.I)
    if not m:
        return months
    mi = MONTHS.index(m.group(1).lower())
    yr = int(m.group(2))
    misses = 0
    while len(months) < max_months:
        mi -= 1
        if mi < 0:
            mi = 11
            yr -= 1
        slug = "%s-%d" % (MONTHS[mi], yr)
        url = "%s/%s" % (BYDATE_BASE, slug)
        try:
            rr = get(url)
            feats = parse_month_features(BeautifulSoup(rr.text, "html.parser")) if rr.status_code == 200 else []
        except Exception:
            feats = []
        if not feats:
            misses += 1
            if misses >= 2:
                break
            continue
        misses = 0
        months.append({"slug": slug, "label": label_from_slug(slug), "url": url, "features": feats})
    return months


def first_two_sentences(text):
    sentences = re.split(r'(?<=[.!?])\s+', (text or "").strip())
    return " ".join(sentences[:2])


def summarize(text, limit=280):
    """First sentence(s), clipped — PA sometimes omits spaces between paragraphs."""
    s = first_two_sentences(text)
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return s


# -- State / diffing -------------------------------------------------------------

def compute_hash(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def load_last_seen():
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}


def save_last_seen(hash_val):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump({"hash": hash_val, "posted_at": datetime.now(timezone.utc).isoformat()}, f, indent=2)


# -- Slack -----------------------------------------------------------------------

def build_slack_blocks(month_label, month_url, features, earlier, scraped_at):
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": "Prisma AIRS — What's New"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": (
            "*%d new feature%s* introduced in *%s*.\n*Scraped:* %s"
            % (len(features), "" if len(features) == 1 else "s", month_label, scraped_at)
        )}},
        {"type": "divider"},
    ]

    # Feature bullets, chunked to stay under Slack's ~3000 char/section limit.
    chunk = ""
    for f in features:
        cat = " `%s`" % f["category"] if f.get("category") and f["category"] != "General" else ""
        line = "• *%s*%s\n" % (f["title"], cat)
        summary = summarize(f["summary"])
        if summary:
            line += "%s\n" % summary
        line += "\n"
        if len(chunk) + len(line) > 2800:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": chunk.strip()}})
            chunk = ""
        chunk += line
    if chunk.strip():
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": chunk.strip()}})

    blocks.append({"type": "section", "text": {"type": "mrkdwn",
                   "text": "<%s|View all %s features →>" % (month_url, month_label)}})

    if earlier:
        ctx = " · ".join("<%s|%s (%d)>" % (m["url"], m["label"], len(m["features"])) for m in earlier)
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": "Earlier: " + ctx}]})

    blocks.append({"type": "divider"})
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": (
        "\U0001F4C4 <%s|All Prisma AIRS new features by date>\n"
        "\U0001F41B <%s|Known Issues>\n"
        "✅ <%s|Addressed Issues>" % (INDEX_URL, KNOWN_ISSUES_URL, ADDRESSED_ISSUES_URL)
    )}})
    return blocks


def post_to_slack(blocks):
    if not SLACK_WEBHOOK_URL:
        raise ValueError("SLACK_WEBHOOK_URL not set in .env")
    resp = requests.post(SLACK_WEBHOOK_URL, json={"blocks": blocks}, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError("Slack returned %s: %s" % (resp.status_code, resp.text))


# -- Preview ---------------------------------------------------------------------

def print_preview(month_label, features, earlier):
    print("\n" + "=" * 65)
    print("PREVIEW — Slack post for %s:" % month_label)
    print("=" * 65)
    for f in features:
        cat = " [%s]" % f["category"] if f.get("category") and f["category"] != "General" else ""
        print("\n   • %s%s" % (f["title"], cat))
        summary = summarize(f["summary"])
        if summary:
            print("     %s" % summary)
    if earlier:
        print("\n   Earlier months: " + ", ".join("%s (%d)" % (m["label"], len(m["features"])) for m in earlier))
    print("\n" + "=" * 65 + "\n")


# -- Main ------------------------------------------------------------------------

def main():
    force = "--force" in sys.argv
    yes = "--yes" in sys.argv

    print("Fetching Prisma AIRS new features (by-date) from docs.paloaltonetworks.com...")
    try:
        latest_slug, latest_url, latest_features = discover_latest()
    except Exception as e:
        print("ERROR: could not fetch latest month: %s" % e)
        sys.exit(1)

    latest_label = label_from_slug(latest_slug)
    print("  Latest month: %s — %d features" % (latest_label, len(latest_features)))

    if not latest_features:
        print("\nNo features parsed from the latest month page. The docs structure may have changed again.")
        sys.exit(1)

    earlier = walk_back(latest_slug)
    for mo in earlier:
        print("  %s: %d features" % (mo["label"], len(mo["features"])))

    # Diff over the latest month's feature signature (title + dates).
    signature = {
        "month": latest_label,
        "features": [{"title": f["title"], "release": f["release"], "updated": f["updated"]} for f in latest_features],
    }
    current_hash = compute_hash(signature)
    last_seen = load_last_seen()

    if not force and last_seen.get("hash") == current_hash:
        print("\nNo new features detected since last post.")
        print("Use --force to post anyway.")
        sys.exit(0)

    print("\nChanges detected since last post!" if last_seen.get("hash") else "\nNo previous state — treating as new.")

    scraped_at = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")
    print_preview(latest_label, latest_features, earlier)

    if not yes:
        try:
            answer = input("Post this to Slack? [y/N] ").strip().lower()
        except EOFError:
            answer = "n"
        if answer != "y":
            print("Aborted. Nothing was posted.")
            sys.exit(0)

    print("Posting to Slack...")
    blocks = build_slack_blocks(latest_label, latest_url, latest_features, earlier, scraped_at)
    post_to_slack(blocks)
    print("Posted successfully!")

    save_last_seen(current_hash)
    print("State saved to %s" % STATE_FILE)


if __name__ == "__main__":
    main()
