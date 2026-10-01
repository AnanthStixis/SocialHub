from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.enums import RoleName
from app.schemas.ai_settings import OpenAIStatusOut, OpenAISaveRequest
from app.services.ai_credentials import openai_status, set_openai_config, clear_openai_config

router = APIRouter(prefix="/api/settings/ai-provider", tags=["ai-settings"])


@router.get("", response_model=OpenAIStatusOut, dependencies=[Depends(require_roles(RoleName.ADMIN.value))])
def get_ai_provider_status(db: Session = Depends(get_db)):
    return openai_status(db)


@router.put("", response_model=OpenAIStatusOut, dependencies=[Depends(require_roles(RoleName.ADMIN.value))])
def save_ai_provider(payload: OpenAISaveRequest, db: Session = Depends(get_db)):
    set_openai_config(db, payload.api_key, payload.base_url, payload.model)
    return openai_status(db)


@router.delete("", response_model=OpenAIStatusOut, dependencies=[Depends(require_roles(RoleName.ADMIN.value))])
def delete_ai_provider(db: Session = Depends(get_db)):
    clear_openai_config(db)
    return openai_status(db)
