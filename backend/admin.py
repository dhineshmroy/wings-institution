"""Admin-only actions that need the Supabase service key:
   - create a login for a teacher / student / parent
   - block or unblock a login
   - bulk import students and parents from a spreadsheet

Every endpoint first checks that the caller is a logged-in, active ADMIN of Wings Institution.
"""
import hashlib
import os
import re
import secrets
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _base() -> str:
    return _env("SUPABASE_URL").rstrip("/")


def _headers(extra: Optional[dict] = None) -> dict:
    key = _env("SUPABASE_SERVICE_KEY")
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _password() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(10))


def _error_text(r: httpx.Response) -> str:
    try:
        j = r.json()
        return str(j.get("msg") or j.get("message") or j.get("error_description") or j.get("error") or r.text)
    except Exception:  # noqa: BLE001
        return r.text


async def current_admin(authorization: Optional[str] = Header(default=None)) -> str:
    if not _base() or not _env("SUPABASE_SERVICE_KEY"):
        raise HTTPException(503, "The backend has no Supabase settings yet (see backend/.env)")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "You are not logged in")
    token = authorization.split(" ", 1)[1]
    async with httpx.AsyncClient(timeout=20) as c:
        u = await c.get(f"{_base()}/auth/v1/user", headers={"apikey": _env("SUPABASE_SERVICE_KEY"), "Authorization": f"Bearer {token}"})
        if u.status_code != 200:
            raise HTTPException(401, "Your login has expired. Please log in again.")
        uid = u.json()["id"]
        p = await c.get(f"{_base()}/rest/v1/profiles", headers=_headers(), params={"id": f"eq.{uid}", "select": "role,status"})
        rows = p.json() if p.status_code == 200 else []
        if not rows or rows[0]["role"] != "admin" or rows[0]["status"] != "active":
            raise HTTPException(403, "Only an admin can do this")
    return uid


# ---------------------------------------------------------------- helpers
async def _create_auth_user(c: httpx.AsyncClient, email: str, password: str, full_name: str, phone: Optional[str], role: str, app_extra: Optional[dict] = None) -> dict:
    r = await c.post(
        f"{_base()}/auth/v1/admin/users",
        headers=_headers(),
        json={
            "email": email.lower(),
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "phone": phone},
            "app_metadata": {"provisioned": True, "role": role, **(app_extra or {})},
        },
    )
    if r.status_code not in (200, 201):
        raise ValueError(_error_text(r))
    return r.json()


async def _find_profile(c: httpx.AsyncClient, email: str) -> Optional[dict]:
    r = await c.get(f"{_base()}/rest/v1/profiles", headers=_headers(), params={"email": f"eq.{email.lower()}", "select": "id,role,full_name"})
    rows = r.json() if r.status_code == 200 else []
    return rows[0] if rows else None


async def _ensure_user(c, email, name, phone, role, created, app_extra=None) -> tuple:
    """Returns (profile id, was_created). Re-uses an existing account with the same e-mail."""
    existing = await _find_profile(c, email)
    if existing:
        if existing["role"] != role:
            raise ValueError(f"{email} already exists as a {existing['role']}, not a {role}")
        return existing["id"], False
    pw = _password()
    user = await _create_auth_user(c, email, pw, name, phone, role, app_extra)
    created.append({"role": role, "name": name, "email": email.lower(), "password": pw})
    return user["id"], True


async def _insert_ignore(c, table: str, payload: dict, conflict: str) -> None:
    r = await c.post(
        f"{_base()}/rest/v1/{table}",
        headers=_headers({"Prefer": "resolution=ignore-duplicates,return=minimal"}),
        params={"on_conflict": conflict},
        json=payload,
    )
    if r.status_code not in (200, 201, 204):
        raise ValueError(_error_text(r))


# ---------------------------------------------------------------- create one login
class NewUser(BaseModel):
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    password: Optional[str] = None


@router.post("/users")
async def create_user(body: NewUser, admin: str = Depends(current_admin)):
    if body.role not in ("teacher", "student", "parent"):
        raise HTTPException(400, "Role must be teacher, student or parent")
    if not EMAIL_RE.match(body.email.strip()):
        raise HTTPException(400, "That e-mail address does not look right")
    if not body.full_name.strip():
        raise HTTPException(400, "Please enter a name")
    pw = body.password or _password()
    if len(pw) < 8:
        raise HTTPException(400, "The password must be at least 8 characters")
    async with httpx.AsyncClient(timeout=30) as c:
        try:
            user = await _create_auth_user(c, body.email.strip(), pw, body.full_name.strip(), body.phone, body.role)
        except ValueError as e:
            raise HTTPException(400, str(e))
    return {"id": user["id"], "email": body.email.strip().lower(), "password": pw, "role": body.role}


# ---------------------------------------------------------------- block / unblock a login
class BanBody(BaseModel):
    banned: bool


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, body: BanBody, admin: str = Depends(current_admin)):
    if user_id == admin:
        raise HTTPException(400, "You cannot block your own login")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(
            f"{_base()}/auth/v1/admin/users/{user_id}",
            headers=_headers(),
            json={"ban_duration": "876000h" if body.banned else "none"},
        )
        if r.status_code not in (200, 201):
            raise HTTPException(400, _error_text(r))
    return {"ok": True}


# ---------------------------------------------------------------- bulk import
class ImportRow(BaseModel):
    student_name: str
    student_email: Optional[str] = None
    student_phone: Optional[str] = None
    parent_name: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None
    class_ids: List[str] = []


class ImportBody(BaseModel):
    rows: List[ImportRow]


def _placeholder_email(row: ImportRow) -> str:
    # Children often have no e-mail. We make a stable stand-in so importing the same row twice finds the same account.
    slug = re.sub(r"[^a-z0-9]+", ".", row.student_name.lower()).strip(".") or "student"
    key = f"{row.student_name.lower()}|{(row.parent_email or row.student_phone or '').lower()}"
    h = hashlib.sha1(key.encode()).hexdigest()[:6]
    domain = _env("IMPORT_PLACEHOLDER_DOMAIN", "students.wingsinstitution.lk")
    return f"{slug}.{h}@{domain}"


async def _process_row(c: httpx.AsyncClient, row: ImportRow, created: list) -> dict:
    name = row.student_name.strip()
    if not name:
        raise ValueError("The student name is empty")
    notes, warnings = [], []

    s_email = (row.student_email or "").strip().lower()
    placeholder = not s_email
    if placeholder:
        s_email = _placeholder_email(row)
    elif not EMAIL_RE.match(s_email):
        raise ValueError(f"Student e-mail '{s_email}' does not look right")

    # a made-up login name is flagged "login_only": the child's updates go to the parent's e-mail instead
    sid, new_student = await _ensure_user(c, s_email, name, row.student_phone, "student", created, {"login_only": True} if placeholder else None)
    notes.append("student created" if new_student else "student already existed")

    p_email = (row.parent_email or "").strip().lower()
    if p_email:
        if not EMAIL_RE.match(p_email):
            warnings.append(f"Parent e-mail '{p_email}' does not look right, so the parent was skipped")
        else:
            try:
                pid, new_parent = await _ensure_user(c, p_email, (row.parent_name or p_email).strip(), row.parent_phone, "parent", created)
                await _insert_ignore(c, "parent_students", {"parent_id": pid, "student_id": sid}, "parent_id,student_id")
                notes.append("parent created and linked" if new_parent else "linked to existing parent")
            except ValueError as e:
                warnings.append(f"Parent: {e}")

    if placeholder and not p_email:
        warnings.append("No parent e-mail, so this student cannot receive e-mail updates")

    enrolled = 0
    for cid in row.class_ids:
        try:
            await _insert_ignore(c, "enrollments", {"class_id": cid, "student_id": sid}, "class_id,student_id")
            enrolled += 1
        except ValueError as e:
            warnings.append(f"Class: {e}")
    if row.class_ids:
        notes.append(f"enrolled in {enrolled} class{'' if enrolled == 1 else 'es'}")

    return {"name": name, "student_id": sid, "status": "warning" if warnings else "ok", "message": "; ".join(notes + warnings)}


@router.post("/import")
async def import_rows(body: ImportBody, admin: str = Depends(current_admin)):
    if len(body.rows) > 100:
        raise HTTPException(400, "Please send at most 100 rows at a time")
    results, created = [], []
    async with httpx.AsyncClient(timeout=60) as c:
        for row in body.rows:
            try:
                results.append(await _process_row(c, row, created))
            except ValueError as e:
                results.append({"name": row.student_name, "status": "error", "message": str(e)})
            except Exception as e:  # noqa: BLE001
                results.append({"name": row.student_name, "status": "error", "message": f"Unexpected problem: {e}"})
    return {"results": results, "created": created}
