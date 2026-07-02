import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    """Wysyła e-mail przez SMTP (STARTTLS).

    Gdy SMTP_HOST nie jest skonfigurowany (dev), treść ląduje w logu backendu
    zamiast być wysyłana — pozwala testować flow bez konta pocztowego.
    """
    if not settings.SMTP_HOST:
        logger.warning("SMTP nieskonfigurowany — e-mail do %s NIE został wysłany.\n"
                       "Temat: %s\n%s", to, subject, text_body)
        print(f"\n=== [DEV] E-mail do {to} ===\nTemat: {subject}\n{text_body}\n===\n", flush=True)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            # Koperta (MAIL FROM) musi być czystym adresem — nagłówek From może mieć nazwę.
            envelope_from = settings.SMTP_USER or settings.SMTP_FROM
            server.sendmail(envelope_from, [to], msg.as_string())
        return True
    except Exception:
        # Nie podnosimy wyjątku — endpoint resetu nie może zdradzać, czy wysyłka
        # się powiodła (user enumeration), a błąd i tak trafia do logów.
        logger.exception("Błąd wysyłki e-maila do %s", to)
        return False


def send_password_reset_email(to: str, username: str, reset_link: str) -> bool:
    subject = "FriendSync — reset hasła"
    text_body = (
        f"Cześć {username}!\n\n"
        f"Otrzymaliśmy prośbę o reset hasła do Twojego konta FriendSync.\n"
        f"Aby ustawić nowe hasło, otwórz poniższy link (ważny 30 minut):\n\n"
        f"{reset_link}\n\n"
        f"Jeśli to nie Ty prosiłeś o reset — zignoruj tę wiadomość, "
        f"Twoje hasło pozostaje bez zmian.\n"
    )
    html_body = (
        f"<p>Cześć <b>{username}</b>!</p>"
        f"<p>Otrzymaliśmy prośbę o reset hasła do Twojego konta FriendSync.</p>"
        f"<p><a href=\"{reset_link}\" style=\"display:inline-block;padding:12px 24px;"
        f"background:#16a34a;color:#fff;text-decoration:none;border-radius:12px;"
        f"font-weight:bold\">Ustaw nowe hasło</a></p>"
        f"<p>Link jest ważny 30 minut. Jeśli przycisk nie działa, skopiuj adres:<br>"
        f"<a href=\"{reset_link}\">{reset_link}</a></p>"
        f"<p style=\"color:#666\">Jeśli to nie Ty prosiłeś o reset — zignoruj tę wiadomość.</p>"
    )
    return send_email(to, subject, text_body, html_body)
