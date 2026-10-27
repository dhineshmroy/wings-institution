"""Sends ONE test e-mail using the settings in backend/.env, so you can check that e-mail really works.

   Usage (from the backend folder, with your virtual environment active):
       python test_email.py your.name@gmail.com
"""
import smtplib
import sys

from dotenv import load_dotenv

load_dotenv()
import emailer  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        print("Please give an e-mail address, for example:  python test_email.py you@gmail.com")
        sys.exit(1)
    to = sys.argv[1]
    mode = emailer._env("EMAIL_MODE", "console")
    if mode != "smtp":
        print(f"EMAIL_MODE is '{mode}'. Set EMAIL_MODE=smtp in backend/.env (and fill in the SMTP_ lines), then try again.")
        sys.exit(1)
    missing = [k for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD") if not emailer._env(k)]
    if missing:
        print("These lines in backend/.env are empty: " + ", ".join(missing))
        sys.exit(1)

    msg = emailer._build(to, "there", [{
        "title": "Test e-mail from Wings Institution",
        "body": "If you can read this, parents will receive their child's arrival and leaving messages in their inbox.",
        "link": "/",
    }])
    try:
        emailer._send_smtp(msg)
    except smtplib.SMTPAuthenticationError:
        print("The e-mail provider refused the login. For Gmail you must turn on 2-Step Verification and use a 16-character")
        print("App Password (not your normal password), with your full address as SMTP_USER.")
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print(f"Could not send: {e}")
        sys.exit(1)
    print(f"Sent! Check the inbox (and the spam folder) of {to}.")


if __name__ == "__main__":
    main()
