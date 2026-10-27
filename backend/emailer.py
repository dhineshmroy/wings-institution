"""Sends the e-mail copy of in-app notifications.

The database creates the notifications. This module reads the ones that have not been e-mailed yet
(using the Supabase service key) and sends them.

* A person with a real e-mail address gets their own notifications there.
* A student WITHOUT an e-mail address (the system gives them a made-up login name) gets their
  notifications sent to their PARENT'S e-mail instead, marked "For <child's name>".
  If the parent already received the very same message, it is not sent twice.
* Everything waiting for one e-mail address is combined into ONE e-mail.

EMAIL_MODE=console  -> prints the e-mails in the terminal (safe for testing)
EMAIL_MODE=smtp     -> really sends them through your SMTP provider
"""
import asyncio
import logging
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html import escape
from pathlib import Path

import httpx

log = logging.getLogger("wings.emailer")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def configured() -> bool:
    return bool(_env("SUPABASE_URL") and _env("SUPABASE_SERVICE_KEY"))


def _headers() -> dict:
    key = _env("SUPABASE_SERVICE_KEY")
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _rest(path: str) -> str:
    return f"{_env('SUPABASE_URL').rstrip('/')}/rest/v1/{path}"


# ---------------------------------------------------------------- e-mail layout
LOGO_FILE = Path(__file__).parent / "assets" / "wings-logo-email.png"


def _html(name: str, items: list, front: str, logo_src: str) -> str:
    greeting = f"Hello {escape(name)}," if name else "Hello,"
    rows = ""
    for n in items:
        url = f"{front}{n['link']}" if n.get("link") else front
        rows += (
            '<tr><td style="padding:16px 0;border-top:1px solid #e1e8f4">'
            f'<div style="font-size:16px;font-weight:700;color:#0a2342;line-height:1.35">{escape(n["title"])}</div>'
            f'<div style="font-size:14px;color:#3d4f6b;margin-top:5px;line-height:1.5">{escape(n.get("body") or "")}</div>'
            f'<a href="{escape(url)}" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#1b5bff;text-decoration:none">Open in Wings Institution</a>'
            "</td></tr>"
        )
    intro = "You have a new update:" if len(items) == 1 else f"You have {len(items)} new updates:"
    logo_tag = f'<img src="{escape(logo_src)}" alt="Wings Institution" height="46" style="display:block;border:0;height:46px;width:auto">' if logo_src else ""
    return f"""<!doctype html><html><body style="margin:0;padding:0;background:#f3f7ff;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e1e8f4">
<tr><td style="padding:26px 28px 6px">{logo_tag}</td></tr>
<tr><td style="padding:10px 28px 4px;font-size:15px;color:#14223a">{greeting}<br><span style="color:#566883">{intro}</span></td></tr>
<tr><td style="padding:6px 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table></td></tr>
<tr><td style="padding:14px 28px 26px;font-size:12px;color:#7a8aa3;border-top:1px solid #e1e8f4">You are receiving this because you are linked to Wings Institution. You can turn these e-mails off on the Notifications page after you log in.</td></tr>
</table></td></tr></table></body></html>"""


def _build(to: str, name: str, items: list) -> EmailMessage:
    front = _env("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    msg = EmailMessage()
    msg["From"] = _env("EMAIL_FROM", "Wings Institution <no-reply@example.com>")
    msg["To"] = to
    hello = f"Hello {name},\n\n" if name else "Hello,\n\n"
    footer = "\nYou can turn these e-mails off on the Notifications page after you log in."
    if len(items) == 1:
        n = items[0]
        url = f"{front}{n['link']}" if n.get("link") else front
        msg["Subject"] = n["title"]
        msg.set_content(f"{hello}{n['title']}\n{n.get('body') or ''}\n\nOpen Wings Institution: {url}\n{footer}")
    else:
        msg["Subject"] = f"{len(items)} new updates from Wings Institution"
        lines = []
        for n in items:
            url = f"{front}{n['link']}" if n.get("link") else front
            lines.append(f"- {n['title']}\n  {n.get('body') or ''}\n  {url}")
        msg.set_content(f"{hello}You have {len(items)} new updates:\n\n" + "\n\n".join(lines) + f"\n{footer}")

    # The logo travels INSIDE the e-mail, so it shows even when the website is not online yet.
    logo_url = _env("EMAIL_LOGO_URL")
    inline = not logo_url and LOGO_FILE.exists()
    msg.add_alternative(_html(name, items, front, "cid:wingslogo" if inline else logo_url), subtype="html")
    if inline:
        msg.get_body(("html",)).add_related(LOGO_FILE.read_bytes(), "image", "png", cid="<wingslogo>", disposition="inline", filename="wings-logo.png")
    return msg


def _send_smtp(msg: EmailMessage) -> None:
    with smtplib.SMTP(_env("SMTP_HOST"), int(_env("SMTP_PORT", "587")), timeout=30) as s:
        s.starttls()
        s.login(_env("SMTP_USER"), _env("SMTP_PASSWORD"))
        s.send_message(msg)


# ---------------------------------------------------------------- who gets which e-mail
def _is_placeholder(email) -> bool:
    """True for the made-up login names given to children without an e-mail address."""
    domain = _env("IMPORT_PLACEHOLDER_DOMAIN", "students.wingsinstitution.lk").lower()
    return bool(email) and email.lower().endswith("@" + domain)


PARENT_PAGES = {"attendance", "grades", "fees", "exams", "announcements", "messages", "calendar", "certificates", "timetable", "performance", "absence", "notifications"}


def _parent_link(link: str) -> str:
    """A child's link such as /student/fees becomes the matching parent page."""
    parts = (link or "").strip("/").split("/")
    if len(parts) >= 2 and parts[1] in PARENT_PAGES:
        return f"/parent/{parts[1]}"
    return "/parent"


def plan_deliveries(rows: list, parents_of: dict) -> tuple:
    """Decides which e-mail address each notification goes to.

    rows:       notifications [{id, user_id, title, body, link, user: {email, full_name, email_notifications}}]
    parents_of: {child id: [{id, email, full_name, email_notifications}, ...]}
    Returns (targets, status). targets: {e-mail: {name, uid, items: {(title, body): item}}}
    status: {notification id: 'skipped'} for the ones that cannot be e-mailed at all.
    """
    targets: dict = {}
    status: dict = {}

    def target(email, name, uid):
        return targets.setdefault(email.lower(), {"name": name, "uid": uid, "items": {}})

    for n in rows:
        u = n.get("user") or {}
        email = u.get("email") or ""
        key = (n["title"], n.get("body") or "")

        if _is_placeholder(email):
            # a child with no e-mail: send it to the parent(s)
            parents = [p for p in parents_of.get(n["user_id"], [])
                       if p and p.get("email") and p.get("email_notifications") is not False and not _is_placeholder(p["email"])]
            if not parents:
                status[n["id"]] = "skipped"
                continue
            child = (u.get("full_name") or "").strip()
            mentions_child = bool(child) and child.lower() in f"{n['title']} {n.get('body') or ''}".lower()
            title = n["title"] if (mentions_child or not child) else f"For {child.split()[0]}: {n['title']}"
            for p in parents:
                t = target(p["email"], p.get("full_name"), p["id"])
                item = t["items"].get(key)
                if item:
                    item["routed"].append(n["id"])
                else:
                    t["items"][key] = {"title": title, "body": n.get("body"), "link": _parent_link(n.get("link")), "own": [], "routed": [n["id"]]}
        else:
            if not email or u.get("email_notifications") is False:
                status[n["id"]] = "skipped"
                continue
            t = target(email, u.get("full_name"), n["user_id"])
            item = t["items"].get(key)
            if item:
                if not item["own"]:  # the parent's own wording wins over "For <child>: ..."
                    item.update(title=n["title"], link=n.get("link"))
                item["own"].append(n["id"])
            else:
                t["items"][key] = {"title": n["title"], "body": n.get("body"), "link": n.get("link"), "own": [n["id"]], "routed": []}
    return targets, status


def drop_recent_duplicates(targets: dict, status: dict, recent: dict) -> None:
    """A child's copy is dropped when that parent already got the same message a moment ago."""
    for t in targets.values():
        for key, item in list(t["items"].items()):
            if not item["own"] and item["routed"] and key in recent.get(t["uid"], set()):
                for i in item["routed"]:
                    status[i] = "merged"
                del t["items"][key]


# ---------------------------------------------------------------- the job
async def process_batch(limit: int = 150) -> dict:
    """E-mail notifications created in the last 3 days that have not been e-mailed yet.

    Everything going to the SAME address (a parent, and children who use the parent's address) is combined
    into ONE e-mail, and identical messages are sent only once.
    """
    since = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    emails = skipped = failed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            _rest("notifications"),
            headers=_headers(),
            params={
                "select": "id,user_id,title,body,link,user:profiles(email,full_name,email_notifications,contact_email,login_only)",
                "emailed_at": "is.null",
                "created_at": f"gte.{since}",
                "order": "created_at.asc",
                "limit": str(limit),
            },
        )
        r.raise_for_status()
        # addresses of people who turned e-mails off: nothing is sent there, even for their children
        off = await client.get(_rest("profiles"), headers=_headers(), params={"select": "email", "email_notifications": "eq.false"})
        opted_out = {(x.get("email") or "").lower() for x in (off.json() if off.status_code == 200 else [])}

        groups: dict = {}
        for idx, n in enumerate(r.json()):
            n["_i"] = idx
            u = n.get("user") or {}
            if u.get("contact_email"):
                dest = u["contact_email"]
            elif u.get("login_only"):
                dest = ""  # a made-up login name that cannot receive mail
            else:
                dest = u.get("email") or ""
            groups.setdefault(dest.strip().lower(), []).append(n)

        for dest, items in groups.items():
            ids = ",".join(i["id"] for i in items)
            wanted = [i for i in items if (i.get("user") or {}).get("email_notifications") is not False]
            if not dest or dest in opted_out or not wanted:
                status = "skipped"
                skipped += len(items)
            else:
                is_owner = lambda i: ((i.get("user") or {}).get("email") or "").lower() == dest  # noqa: E731
                seen, send = set(), []
                for i in sorted(wanted, key=lambda i: (0 if is_owner(i) else 1, i["_i"])):  # the address owner's copy wins
                    key = (i["title"], i.get("body") or "")
                    if key in seen:
                        continue
                    seen.add(key)
                    body = i.get("body") or ""
                    name = (i.get("user") or {}).get("full_name")
                    if not is_owner(i) and name:  # make clear which child it is about
                        body = f"{name}: {body}" if body else name
                    send.append({**i, "body": body})
                send.sort(key=lambda i: i["_i"])
                owner = next((i["user"] for i in wanted if is_owner(i)), None) or (wanted[0].get("user") or {})
                try:
                    msg = _build(dest, owner.get("full_name"), send)
                    if _env("EMAIL_MODE", "console") == "smtp":
                        await asyncio.to_thread(_send_smtp, msg)
                        status = "sent"
                    else:
                        log.info("[EMAIL - console mode] To: %s | %s | %s", dest, msg["Subject"], " / ".join(i["title"] for i in send))
                        status = "console"
                    emails += 1
                except Exception as e:  # noqa: BLE001
                    status = f"failed: {e}"[:200]
                    failed += 1
                    log.error("Could not e-mail %s: %s", dest, e)
            await client.patch(
                _rest("notifications"),
                headers=_headers(),
                params={"id": f"in.({ids})"},
                json={"emailed_at": datetime.now(timezone.utc).isoformat(), "email_status": status},
            )
    return {"emails_sent": emails, "skipped": skipped, "failed": failed}


async def run_fee_reminders() -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(_rest("rpc/send_fee_reminders"), headers=_headers(), json={})
        r.raise_for_status()
        return {"reminders_created": r.json()}


async def poll_forever(interval: int) -> None:
    log.info("E-mail sender started (every %s seconds, mode: %s)", interval, _env("EMAIL_MODE", "console"))
    while True:
        try:
            await process_batch()
        except Exception as e:  # noqa: BLE001
            log.error("E-mail run failed: %s", e)
        await asyncio.sleep(interval)
