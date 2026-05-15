import os
import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings


AVATAR_DIR = Path("static/avatars")

_ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

# Magic bytes — weryfikujemy realny typ pliku, nie tylko content-type z requesta.
_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
]


def _looks_like_webp(head: bytes) -> bool:
    return len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP"


def _detect_extension(head: bytes) -> str | None:
    for sig, ext in _SIGNATURES:
        if head.startswith(sig):
            return ext
    if _looks_like_webp(head):
        return ".webp"
    return None


async def save_avatar(file: UploadFile, owner_key: str) -> str:
    """Bezpieczny zapis avatara. Zwraca względną ścieżkę zapisanego pliku.

    - Sprawdza rozmiar (limit z settings.MAX_AVATAR_SIZE).
    - Sprawdza realny typ pliku po magic bytes (nie ufa content-type).
    - Generuje losową nazwę, eliminując path traversal i kolizje.
    """
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Dozwolone formaty: JPEG, PNG, WEBP, GIF.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Pusty plik.")
    if len(content) > settings.MAX_AVATAR_SIZE:
        max_mb = settings.MAX_AVATAR_SIZE // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"Plik za duży (max {max_mb} MB).")

    ext = _detect_extension(content[:16])
    if ext is None:
        raise HTTPException(status_code=400, detail="Plik nie jest prawidłowym obrazem.")

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)

    # Nazwa pliku w pełni kontrolowana po stronie serwera — bez fragmentów z usera.
    safe_owner = "".join(c for c in str(owner_key) if c.isalnum())[:32] or "user"
    filename = f"{safe_owner}_{secrets.token_urlsafe(16)}{ext}"
    target = AVATAR_DIR / filename

    # Defensywnie: target musi być wewnątrz AVATAR_DIR.
    target_resolved = target.resolve()
    if not str(target_resolved).startswith(str(AVATAR_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Nieprawidłowa ścieżka pliku.")

    with open(target, "wb") as buf:
        buf.write(content)

    return str(target).replace(os.sep, "/")
