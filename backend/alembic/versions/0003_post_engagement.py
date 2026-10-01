"""post engagement counts

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-01

Idempotent like 0002: a fresh database already has the columns from create_all().
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

COLUMNS = [
    ("likes_count", sa.Column("likes_count", sa.Integer(), nullable=False, server_default="0")),
    ("comments_count", sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0")),
    ("engagement_synced_at", sa.Column("engagement_synced_at", sa.DateTime(timezone=True))),
]


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("post_platforms")}
    for name, column in COLUMNS:
        if name not in existing:
            op.add_column("post_platforms", column)


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column("post_platforms", name)
