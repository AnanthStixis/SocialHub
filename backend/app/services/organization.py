from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.system import SystemSetting

_KEY = "organization"


def get_org_name(db: Session) -> str | None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _KEY))
    name = (row.value.get("name") if row else None) or ""
    return name.strip() or None


def set_org_name(db: Session, name: str) -> None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _KEY))
    if row:
        row.value = {"name": name}
    else:
        db.add(SystemSetting(key=_KEY, value={"name": name}, description="Organization display name"))
    db.commit()
