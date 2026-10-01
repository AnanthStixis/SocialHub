"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-29

"""
from alembic import op
from app.db.session import Base
import app.models  # noqa: F401 registers all tables on Base.metadata

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
