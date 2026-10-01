from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import RoleName
from app.services.organization import get_org_name, set_org_name

router = APIRouter(prefix="/api/settings/organization", tags=["organization"])


class OrgIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


@router.get("")
def read_org(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return {"name": get_org_name(db)}


@router.put("", dependencies=[Depends(require_roles(RoleName.ADMIN.value))])
def save_org(payload: OrgIn, db: Session = Depends(get_db)):
    set_org_name(db, payload.name.strip())
    return {"name": get_org_name(db)}
