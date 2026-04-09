"""
SMTP backend that connects over IPv4 only.

Many hosts (VPS, home networks) advertise IPv6 but cannot route traffic to
external SMTP (e.g. smtp.gmail.com). Python's smtplib uses ``socket.create_connection``,
which may try IPv6 first and hang until ``errno 110 (ETIMEDOUT)`` — the same error
even with a very large ``EMAIL_TIMEOUT``.

Set ``EMAIL_USE_IPV4=True`` (default in settings when using this backend) to force
IPv4 for the outbound SMTP connection.
"""
import socket
import smtplib

from django.core.mail.backends.smtp import EmailBackend as DjangoSMTPEmailBackend


def _ipv4_socket(host, port, timeout, source_address=None):
    """Like ``socket.create_connection`` but only tries ``AF_INET`` addresses."""
    if timeout is not None and not timeout:
        raise ValueError("Non-blocking socket (timeout=0) is not supported")
    last_exc = None
    for res in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res
        sock = socket.socket(af, socktype, proto)
        sock.settimeout(timeout)
        try:
            if source_address is not None:
                sock.bind(source_address)
            sock.connect(sa)
            return sock
        except OSError as exc:
            last_exc = exc
            sock.close()
    if last_exc is not None:
        raise last_exc
    raise OSError(f"No IPv4 addresses found for {host!r}")

class SMTP_IPv4(smtplib.SMTP):
    def _get_socket(self, host, port, timeout):
        return _ipv4_socket(host, port, timeout, self.source_address)


class SMTP_SSL_IPv4(smtplib.SMTP_SSL):
    def _get_socket(self, host, port, timeout):
        new_socket = _ipv4_socket(host, port, timeout, self.source_address)
        return self.context.wrap_socket(new_socket, server_hostname=self._host)


class IPv4EmailBackend(DjangoSMTPEmailBackend):
    """Same as Django's SMTP backend, but uses IPv4-only SMTP classes."""

    @property
    def connection_class(self):
        return SMTP_SSL_IPv4 if self.use_ssl else SMTP_IPv4
