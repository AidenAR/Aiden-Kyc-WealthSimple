import os
import uuid
from pathlib import Path
from PIL import Image
import io

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_IMAGE_DIMENSION = 2048

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".webm", ".ogg", ".wav", ".mp3", ".m4a"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
AUDIO_EXTENSIONS = {".webm", ".ogg", ".wav", ".mp3", ".m4a"}


def save_document(file_bytes: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit")

    if ext in IMAGE_EXTENSIONS:
        file_bytes = _resize_if_needed(file_bytes)

    stored_name = f"{uuid.uuid4()}{ext}"
    path = UPLOAD_DIR / stored_name
    path.write_bytes(file_bytes)
    return stored_name


def _resize_if_needed(file_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(file_bytes))
    if max(img.size) > MAX_IMAGE_DIMENSION:
        img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)
        buffer = io.BytesIO()
        fmt = img.format or "JPEG"
        img.save(buffer, format=fmt, quality=85)
        return buffer.getvalue()
    return file_bytes


def get_document_path(filename: str) -> Path:
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {filename}")
    return path


def cleanup_uploads():
    for f in UPLOAD_DIR.iterdir():
        if f.is_file() and f.name != ".gitkeep":
            f.unlink()
