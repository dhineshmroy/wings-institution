import asyncio
import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")

import emailer  # noqa: E402  (after load_dotenv so it can read the settings)
from admin import router as admin_router  # noqa: E402
from parent import router as parent_router  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    interval = int(os.getenv("EMAIL_POLL_SECONDS", "0") or 0)
    if interval > 0 and emailer.configured():
        task = asyncio.create_task(emailer.poll_forever(interval))
    yield
    if task:
        task.cancel()


app = FastAPI(title="Wings Institution API", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(parent_router)


def require_key(key: Optional[str]) -> None:
    secret = os.getenv("JOB_SECRET", "")
    if not secret or not key or not hmac.compare_digest(key, secret):
        raise HTTPException(status_code=401, detail="Missing or wrong X-Job-Key")


@app.get("/")
def root():
    return {"app": "Wings Institution API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok", "emails_configured": emailer.configured()}


# Called by a scheduler (for example cron-job.org) with the header  X-Job-Key: <JOB_SECRET>
@app.post("/jobs/send-emails")
async def send_emails(x_job_key: Optional[str] = Header(default=None)):
    require_key(x_job_key)
    return await emailer.process_batch()


@app.post("/jobs/fee-reminders")
async def fee_reminders(x_job_key: Optional[str] = Header(default=None)):
    require_key(x_job_key)
    return await emailer.run_fee_reminders()
