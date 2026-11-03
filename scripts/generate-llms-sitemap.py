#!/usr/bin/env python3
"""Regenerate llms-full.txt and public/sitemap.xml from the current docs.

Run from the repo root: python3 scripts/generate-llms-sitemap.py
"""
import datetime
import json
import subprocess

BASE_URL = "https://docs.me-cash.com"

# Overview pages concatenated into llms-full.txt, in reading order.
LLMS_FULL_PAGES = [
    "index",
    "quickstart",
    "authentication",
    "wallet-docs/wallet-overview",
    "quote-docs/about-quote",
    "payout-docs/payout",
    "payout-docs/bulk-payout",
    "webhook/webhook",
    "virtual-accounts-docs/about-virtual-account",
    "ramp-docs/ramp-overview",
]


def nav_pages(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, list):
        for item in node:
            yield from nav_pages(item)
    elif isinstance(node, dict):
        for key in ("tabs", "groups", "pages"):
            if key in node:
                yield from nav_pages(node[key])


def last_modified(path):
    dirty = subprocess.run(["git", "diff", "--quiet", "HEAD", "--", path]).returncode != 0
    if dirty:
        return datetime.date.today().isoformat()
    date = subprocess.check_output(["git", "log", "-1", "--format=%cs", "--", path], text=True).strip()
    return date or datetime.date.today().isoformat()


def build_llms_full():
    chunks = []
    for page in LLMS_FULL_PAGES:
        with open(page + ".mdx", encoding="utf-8") as f:
            chunks.append(f.read().rstrip("\n") + "\n")
    return "\n\n".join(chunks)


def build_sitemap():
    with open("docs.json", encoding="utf-8") as f:
        config = json.load(f)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    seen = set()
    for page in nav_pages(config["navigation"]):
        if page in seen:
            continue
        seen.add(page)
        is_root = page == "index"
        route = "" if is_root else page[: -len("/index")] if page.endswith("/index") else page
        lines += [
            "  <url>",
            f"    <loc>{BASE_URL}/{route}</loc>",
            f"    <lastmod>{last_modified(page + '.mdx')}</lastmod>",
            "    <changefreq>monthly</changefreq>",
            f"    <priority>{'1.0' if is_root else '0.7'}</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main():
    outputs = {"llms-full.txt": build_llms_full(), "public/sitemap.xml": build_sitemap()}
    for path, content in outputs.items():
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"updated {path}")


if __name__ == "__main__":
    main()
