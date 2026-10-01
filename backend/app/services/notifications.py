from sqlalchemy.orm import Session
from app.models.workflow import Notification
from app.models.enums import NotificationType


def notify(
    db: Session,
    user_id: str,
    type_: NotificationType,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            type=type_,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    )
