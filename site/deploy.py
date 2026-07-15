#!/usr/bin/env python3
"""Deploy the agent-wrapped site to Vercel via API (static + api functions)."""
import json
import os
import subprocess
import urllib.request
import base64
import sys

PROJECT_NAME = "agent-wrapped"
ROOT = os.path.dirname(os.path.abspath(__file__))

FILES = [
    "index.html",
    "landing-cards.js",
    "logos/vellum.png",
    "logos/claude.png",
    "logos/openclaw.png",
    "logos/hermes.png",
    "app.html",
    "app.js",
    "app.css",
    "vercel.json",
    "package.json",
    "api/page.js",
    "api/og.js",
    "api/publish.js",
    "api/delete.js",
]


def get_vercel_token():
    try:
        r = subprocess.run(
            ["assistant", "credentials", "reveal", "--service", "vercel", "--field", "api_token"],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    try:
        req = urllib.request.Request(
            "http://localhost:8090/credentials/vercel/api_token",
            headers={"Authorization": f"Bearer {os.environ.get('CES_SERVICE_TOKEN', '')}"},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            return json.loads(resp.read()).get("value")
    except Exception:
        pass
    return os.environ.get("VERCEL_TOKEN")


def main():
    token = get_vercel_token()
    if not token:
        print("no vercel token found", file=sys.stderr)
        sys.exit(1)

    files = []
    for rel in FILES:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            print(f"skip missing {rel}", file=sys.stderr)
            continue
        with open(path, "rb") as f:
            files.append({
                "file": rel,
                "data": base64.b64encode(f.read()).decode(),
                "encoding": "base64",
            })

    payload = json.dumps({
        "name": PROJECT_NAME,
        "project": PROJECT_NAME,
        "target": "production",
        "files": files,
        "projectSettings": {"framework": None},
    }).encode()

    req = urllib.request.Request(
        "https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1",
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        out = json.loads(resp.read())
    print(json.dumps({
        "id": out.get("id"),
        "url": out.get("url"),
        "readyState": out.get("readyState"),
    }, indent=2))


if __name__ == "__main__":
    main()
