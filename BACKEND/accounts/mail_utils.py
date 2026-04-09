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
    if "console" in str(getattr(settings, "EMAIL_BACKEND", "")).lower():
        raise ValueError(
            "Email backend is console-only. Configure SMTP env vars on the server "
            "(EMAIL_HOST/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD/DEFAULT_FROM_EMAIL)."
        )
    if not getattr(settings, "DEFAULT_FROM_EMAIL", None):
        raise ValueError("DEFAULT_FROM_EMAIL is not configured.")

    app_name = getattr(settings, "EMAIL_APP_NAME", "TRIPLINK")
    subject = f"{app_name} verification code"
    ttl_minutes = 5
    plain = (
        f"{app_name} Verification Code\n"
        f"{'=' * (len(app_name) + 18)}\n\n"
        "Hello,\n\n"
        f"Use this verification code to continue: {otp}\n\n"
        f"This code expires in {ttl_minutes} minutes.\n"
        "Do not share this code with anyone.\n\n"
        "If you did not request this verification, you can safely ignore this email.\n\n"
        f"Regards,\n{app_name} Team"
    )
    safe_otp = html.escape(otp)
    safe_app_name = html.escape(app_name)
    html_body = (
        "<div style=\"margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;\">"
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;\">"
        "<tr><td style=\"padding:20px 24px;background:#0f6b34;color:#ffffff;\">"
        f"<h2 style=\"margin:0;font-size:18px;font-weight:700;\">{safe_app_name} Verification Code</h2>"
        "</td></tr>"
        "<tr><td style=\"padding:24px;\">"
        "<p style=\"margin:0 0 12px 0;font-size:14px;line-height:1.6;\">Hello,</p>"
        "<p style=\"margin:0 0 12px 0;font-size:14px;line-height:1.6;\">Use the code below to continue your request:</p>"
        f"<div style=\"margin:12px 0 16px 0;padding:14px 16px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;text-align:center;\">"
        f"<span style=\"font-size:30px;letter-spacing:8px;font-weight:700;color:#0f172a;\">{safe_otp}</span>"
        "</div>"
        f"<p style=\"margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#334155;\">This code expires in {ttl_minutes} minutes.</p>"
        "<p style=\"margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#334155;\">Do not share this code with anyone.</p>"
        "<p style=\"margin:0;font-size:13px;line-height:1.6;color:#64748b;\">If you did not request this verification, you can safely ignore this email.</p>"
        "</td></tr>"
        "<tr><td style=\"padding:14px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;\">"
        f"<p style=\"margin:0;font-size:12px;color:#64748b;\">{safe_app_name} Team</p>"
        "</td></tr>"
        "</table>"
        "</div>"
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
    if "console" in str(getattr(settings, "EMAIL_BACKEND", "")).lower():
        raise ValueError(
            "Email backend is console-only. Configure SMTP env vars on the server "
            "(EMAIL_HOST/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD/DEFAULT_FROM_EMAIL)."
        )
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
        f"{app_name} Agent Account Details",
        "=" * (len(app_name) + 22),
        "",
        f"Hello {display_name},",
        "",
        f"Your agent account has been created on {company}.",
        "",
        f"Login email: {email}",
        f"Temporary password: {password}",
        f"Login URL: {login_url}",
        "",
        "For security, please sign in and change your password immediately.",
    ]
    if support:
        plain_lines.extend(["", f"Support: {support}"])
    if contact:
        plain_lines.extend(["", contact])

    plain = "\n".join(plain_lines)

    html_parts = [
        "<div style=\"margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;\">",
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;\">",
        "<tr><td style=\"padding:20px 24px;background:#0f6b34;color:#ffffff;\">",
        f"<h2 style=\"margin:0;font-size:18px;font-weight:700;\">{html.escape(app_name)} Agent Account Created</h2>",
        "</td></tr>",
        "<tr><td style=\"padding:24px;\">",
        f"<p style=\"margin:0 0 12px 0;font-size:14px;line-height:1.6;\">Hello {safe_name},</p>",
        f"<p style=\"margin:0 0 14px 0;font-size:14px;line-height:1.6;\">Your agent account has been created on <strong>{safe_company}</strong>.</p>",
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;\">",
        "<tr><td style=\"padding:14px 16px;\">",
        f"<p style=\"margin:0 0 8px 0;font-size:13px;\"><strong>Login email:</strong> {safe_email}</p>",
        f"<p style=\"margin:0 0 8px 0;font-size:13px;\"><strong>Temporary password:</strong> {safe_password}</p>",
        f"<p style=\"margin:0;font-size:13px;\"><strong>Login URL:</strong> <a href=\"{safe_url}\" style=\"color:#0f6b34;text-decoration:none;\">{safe_url}</a></p>",
        "</td></tr>",
        "</table>",
        "<p style=\"margin:14px 0 0 0;font-size:13px;line-height:1.6;color:#334155;\">For security, please sign in and change your password immediately.</p>",
    ]
    if safe_support:
        html_parts.append(f"<p>Support: {safe_support}</p>")
    if safe_contact:
        html_parts.append(f"<p>{safe_contact}</p>")
    html_parts.append("</td></tr>")
    html_parts.append("<tr><td style=\"padding:14px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;\">")
    html_parts.append(f"<p style=\"margin:0;font-size:12px;color:#64748b;\">{safe_system}</p>")
    html_parts.append("</td></tr>")
    html_parts.append("</table>")
    html_parts.append("</div>")
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
