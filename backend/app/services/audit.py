from sqlalchemy.orm import Session
from app.models.workflow import AuditLog
from app.models.enums import AuditAction


def record_audit(
    db: Session,
    user_id: str | None,
    action: AuditAction,
    entity_type: str,
    entity_id: str | None,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {},
            ip_address=ip_address,
        )
    )
    db.commit()
