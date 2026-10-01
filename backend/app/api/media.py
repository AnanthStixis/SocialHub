import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import get_settings
from app.core.deps import get_current_user, require_roles, STAFF_ROLES
from app.models.media import MediaAsset
from app.models.post import Post
from app.models.user import User
from app.models.enums import RoleName
from app.schemas.media import MediaAssetOut, MediaUrlAttach

router = APIRouter(prefix="/api/posts", tags=["media"])
settings = get_settings()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _get_post_or_404(db: Session, post_id: str) -> Post:
    post = db.get(Post, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "POST_NOT_FOUND", "message": "Post not found"}},
        )
    return post


@router.post(
    "/{post_id}/media",
    response_model=MediaAssetOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
async def upload_media(
    post_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)

    if file.content_type in ALLOWED_IMAGE_TYPES:
        media_type = "image"
    elif file.content_type in ALLOWED_VIDEO_TYPES:
        media_type = "video"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {"code": "UNSUPPORTED_MEDIA_TYPE", "message": f"Unsupported file type: {file.content_type}"},
            },
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "FILE_TOO_LARGE", "message": "File exceeds the 50MB limit"}},
        )

    ext = Path(file.filename or "").suffix or (".jpg" if media_type == "image" else ".mp4")
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)

    asset = MediaAsset(
        post_id=post.id,
        uploaded_by=current_user.id,
        file_name=file.filename or stored_name,
        file_url=f"{settings.APP_URL}/uploads/{stored_name}",
        media_type=media_type,
        mime_type=file.content_type,
        order_index=len(post.media_assets),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.post(
    "/{post_id}/media/url",
    response_model=MediaAssetOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def attach_media_url(
    post_id: str,
    payload: MediaUrlAttach,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach an already-hosted image/video by URL instead of uploading a
    file — useful for media hosted elsewhere, and the only way media will
    actually be reachable by a real platform's API when this app itself is
    only running on localhost."""
    post = _get_post_or_404(db, post_id)
    asset = MediaAsset(
        post_id=post.id,
        uploaded_by=current_user.id,
        file_name=str(payload.url).rsplit("/", 1)[-1] or "linked-media",
        file_url=str(payload.url),
        media_type=payload.media_type,
        mime_type=None,
        order_index=len(post.media_assets),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{post_id}/media", response_model=list[MediaAssetOut])
def list_media(post_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    post = _get_post_or_404(db, post_id)
    return post.media_assets


@router.delete(
    "/{post_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def delete_media(post_id: str, media_id: str, db: Session = Depends(get_db)):
    asset = db.get(MediaAsset, media_id)
    if not asset or asset.post_id != post_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "MEDIA_NOT_FOUND", "message": "Media asset not found"}},
        )
    if asset.file_url.startswith(f"{settings.APP_URL}/uploads/"):
        stored_name = asset.file_url.rsplit("/", 1)[-1]
        try:
            (UPLOAD_DIR / stored_name).unlink(missing_ok=True)
        except Exception:
            pass
    db.delete(asset)
    db.commit()
