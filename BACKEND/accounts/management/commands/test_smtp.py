"""
Diagnose outbound SMTP connectivity (same path as OTP emails).

Usage:
  python manage.py test_smtp
  python manage.py test_smtp --to you@example.com   # optional: send a real test message
"""
import socket
import time

from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.core.management.base import BaseCommand


def _try_tcp(host, port, timeout, ipv4_only=False):
    """Return (ok: bool, detail: str, elapsed: float)."""
    t0 = time.monotonic()
    try:
        if ipv4_only:
            last = None
            for res in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
                af, socktype, proto, canonname, sa = res
                sock = socket.socket(af, socktype, proto)
                sock.settimeout(timeout)
                try:
                    sock.connect(sa)
                    sock.close()
                    return True, f"IPv4 connect OK to {sa[0]}:{port}", time.monotonic() - t0
                except OSError as e:
                    last = e
                    sock.close()
            raise last or OSError("no IPv4 addr")
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        return True, "create_connection OK (system default address family)", time.monotonic() - t0
    except OSError as e:
        return False, f"{type(e).__name__}: {e}", time.monotonic() - t0


class Command(BaseCommand):
    help = "Test SMTP settings and optional send (same stack as OTP email)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            dest="to_email",
            default="",
            help="If set, send one test email to this address via Django mail.",
        )
        parser.add_argument(
            "--timeout",
            type=int,
            default=None,
            help="Override EMAIL_TIMEOUT for this run (seconds).",
        )

    def handle(self, *args, **options):
        host = getattr(settings, "EMAIL_HOST", "") or ""
        port = int(getattr(settings, "EMAIL_PORT", 587) or 587)
        timeout = options["timeout"]
        if timeout is None:
            timeout = getattr(settings, "EMAIL_TIMEOUT", None) or 30
        use_tls = getattr(settings, "EMAIL_USE_TLS", True)
        use_ssl = getattr(settings, "EMAIL_USE_SSL", False)
        backend = getattr(settings, "EMAIL_BACKEND", "")
        ipv4 = getattr(settings, "EMAIL_USE_IPV4", None)

        self.stdout.write(f"EMAIL_BACKEND: {backend}")
        self.stdout.write(f"EMAIL_HOST: {host!r}  PORT: {port}  TLS: {use_tls}  SSL: {use_ssl}")
        self.stdout.write(f"EMAIL_TIMEOUT: {timeout}s")
        if ipv4 is not None:
            self.stdout.write(f"EMAIL_USE_IPV4: {ipv4}")

        if not host:
            self.stderr.write("EMAIL_HOST is empty — OTP cannot use SMTP.")
            return

        self.stdout.write("\n--- Raw TCP probes ---")
        ok, msg, elapsed = _try_tcp(host, port, timeout, ipv4_only=False)
        self.stdout.write(f"[default] {elapsed:.2f}s  {msg}")
        ok4, msg4, elapsed4 = _try_tcp(host, port, timeout, ipv4_only=True)
        self.stdout.write(f"[IPv4]    {elapsed4:.2f}s  {msg4}")

        if ok and not ok4:
            self.stdout.write(
                self.style.WARNING(
                    "Default path works but IPv4-only failed — unusual; check firewall/DNS."
                )
            )
        if not ok and ok4:
            self.stdout.write(
                self.style.WARNING(
                    "IPv4 works but default (often IPv6-first) timed out — enable EMAIL_USE_IPV4=True "
                    "and IPv4EmailBackend (project default when EMAIL_USE_IPV4 is True)."
                )
            )
        if not ok and not ok4:
            self.stderr.write(
                self.style.ERROR(
                    "Neither default nor IPv4 TCP reached the server. Outbound port may be blocked "
                    f"by your network/hosting, or {host} is unreachable. Errno 110 usually means "
                    "blocked route or firewall, not Django bug."
                )
            )

        self.stdout.write("\n--- Django get_connection().open() ---")
        t0 = time.monotonic()
        try:
            conn = get_connection()
            conn.open()
            conn.close()
            self.stdout.write(self.style.SUCCESS(f"OK in {time.monotonic() - t0:.2f}s"))
        except OSError as e:
            self.stderr.write(self.style.ERROR(f"FAILED: {e}"))

        to_email = (options.get("to_email") or "").strip()
        if to_email:
            self.stdout.write(f"\n--- Sending test email to {to_email} ---")
            try:
                msg = EmailMessage(
                    "TRIPLINK SMTP test",
                    "If you receive this, outbound SMTP from this server works.",
                    settings.DEFAULT_FROM_EMAIL,
                    [to_email],
                )
                msg.send()
                self.stdout.write(self.style.SUCCESS("send() completed."))
            except OSError as e:
                self.stderr.write(self.style.ERROR(f"send failed: {e}"))
