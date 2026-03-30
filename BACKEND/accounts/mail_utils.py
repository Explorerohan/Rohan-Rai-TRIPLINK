"""
Send transactional email via Django's email API (SMTP or console in development).
"""
import html
import random

from django.conf import settings
from django.core.mail import send_mail


def generate_otp():
    """Generate a 4-digit OTP."""
    return str(random.randint(1000, 9999))


def send_otp_email(email, otp):
    """
    Send a one-time password to the given address.

    Raises:
        Exception: If configuration is missing or sending fails.
    """
    if not getattr(settings, "DEFAULT_FROM_EMAIL", None):
        raise ValueError("DEFAULT_FROM_EMAIL is not configured.")

    app_name = getattr(settings, "EMAIL_APP_NAME", "TRIPLINK")
    subject = f"{app_name} verification code"
    ttl_minutes = 5
    plain = (
        f"Your {app_name} verification code is {otp}.\n\n"
        f"This code expires in {ttl_minutes} minutes.\n"
        f"If you did not request this, you can ignore this email."
    )
    safe_otp = html.escape(otp)
    html_body = (
        f"<p>Your <strong>{html.escape(app_name)}</strong> verification code is "
        f"<strong style=\"font-size:1.25em;letter-spacing:0.1em;\">{safe_otp}</strong>.</p>"
        f"<p>This code expires in {ttl_minutes} minutes.</p>"
        "<p>If you did not request this, you can ignore this email.</p>"
    )

    send_mail(
        subject=subject,
        message=plain,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
        html_message=html_body,
    )
    return {"status": "sent"}


def send_agent_credentials_email(email, password, login_url, agent_name=None):
    """
    Send new agent account credentials (initial password and login link).

    Raises:
        Exception: If configuration is missing or sending fails.
    """
    if not getattr(settings, "DEFAULT_FROM_EMAIL", None):
        raise ValueError("DEFAULT_FROM_EMAIL is not configured.")

    app_name = getattr(settings, "EMAIL_APP_NAME", "TRIPLINK")
    company = getattr(settings, "EMAIL_COMPANY_NAME", app_name)
    support = getattr(settings, "EMAIL_SUPPORT_ADDRESS", "")
    system_name = getattr(settings, "EMAIL_SYSTEM_NAME", app_name)
    contact = getattr(settings, "EMAIL_CONTACT_INFORMATION", "")

    display_name = agent_name or email.split("@")[0]
    safe_name = html.escape(display_name)
    safe_email = html.escape(email)
    safe_password = html.escape(password)
    safe_url = html.escape(login_url)
    safe_company = html.escape(company)
    safe_support = html.escape(support) if support else ""
    safe_system = html.escape(system_name)
    safe_contact = html.escape(contact) if contact else ""

    subject = f"Your {app_name} agent account"

    plain_lines = [
        f"Hello {display_name},",
        "",
        f"An agent account was created for you on {company}.",
        f"Email (login): {email}",
        f"Temporary password: {password}",
        f"Login: {login_url}",
        "",
        "Please sign in and change your password as soon as possible.",
    ]
    if support:
        plain_lines.extend(["", f"Support: {support}"])
    if contact:
        plain_lines.extend(["", contact])

    plain = "\n".join(plain_lines)

    html_parts = [
        f"<p>Hello {safe_name},</p>",
        f"<p>An agent account was created for you on <strong>{safe_company}</strong>.</p>",
        "<ul>",
        f"<li><strong>Email (login):</strong> {safe_email}</li>",
        f"<li><strong>Temporary password:</strong> {safe_password}</li>",
        f"<li><strong>Login:</strong> <a href=\"{safe_url}\">{safe_url}</a></li>",
        "</ul>",
        "<p>Please sign in and change your password as soon as possible.</p>",
    ]
    if safe_support:
        html_parts.append(f"<p>Support: {safe_support}</p>")
    if safe_contact:
        html_parts.append(f"<p>{safe_contact}</p>")
    html_parts.append(f"<p style=\"color:#666;font-size:0.9em;\">{safe_system}</p>")
    html_body = "".join(html_parts)

    send_mail(
        subject=subject,
        message=plain,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
        html_message=html_body,
    )
    return {"status": "sent"}
