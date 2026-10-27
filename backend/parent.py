"""Actions a PARENT can take for their own children (needs the Supabase service key):
   - register a child who has no e-mail address
   - set a login password for an older child

Every endpoint first checks that the caller is a logged-in, active PARENT, and that the child belongs to them.
"""
import re
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from admin import _base, _create_auth_user, _env, _error_text, _headers, _password

router = APIRouter(prefix="/parent", tags=["parent"])
MAX_CHILDREN = 12


async def current_parent(authorization: Optional[str] = Header(default=None)) -> str:
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
        if not rows or rows[0]["role"] != "parent" or rows[0]["status"] != "active":
            raise HTTPException(403, "Only an approved parent account can do this")
    return uid


class NewChild(BaseModel):
    full_name: str


@router.post("/children")
async def add_child(body: NewChild, parent: str = Depends(current_parent)):
    name = body.full_name.strip()
    if not name:
        raise HTTPException(400, "Please enter your child's name")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{_base()}/rest/v1/parent_students", headers=_headers(), params={"parent_id": f"eq.{parent}", "select": "id"})
        if r.status_code == 200 and len(r.json()) >= MAX_CHILDREN:
            raise HTTPException(400, f"You can have up to {MAX_CHILDREN} children on one account. Please contact the institute.")

        # a made-up login name: the child does not need an e-mail address
        slug = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".") or "student"
        domain = _env("IMPORT_PLACEHOLDER_DOMAIN", "students.wingsinstitution.lk")
        login_name = f"{slug}.{uuid.uuid4().hex[:8]}@{domain}"
        try:
            # the password is random and never shown: the child cannot log in until the parent sets one
            user = await _create_auth_user(c, login_name, _password() + _password(), name, None, "student", {"parent_id": parent, "login_only": True})
        except ValueError as e:
            raise HTTPException(400, str(e))
    return {"id": user["id"], "login_name": login_name}


class PasswordBody(BaseModel):
    password: str


@router.post("/children/{child_id}/password")
async def set_child_password(child_id: str, body: PasswordBody, parent: str = Depends(current_parent)):
    if len(body.password) < 8:
        raise HTTPException(400, "The password must be at least 8 characters")
    async with httpx.AsyncClient(timeout=30) as c:
        link = await c.get(f"{_base()}/rest/v1/parent_students", headers=_headers(),
                           params={"parent_id": f"eq.{parent}", "student_id": f"eq.{child_id}", "select": "id"})
        if link.status_code != 200 or not link.json():
            raise HTTPException(403, "That child is not linked to your account")
        r = await c.put(f"{_base()}/auth/v1/admin/users/{child_id}", headers=_headers(), json={"password": body.password})
        if r.status_code not in (200, 201):
            raise HTTPException(400, _error_text(r))
    return {"ok": True}
