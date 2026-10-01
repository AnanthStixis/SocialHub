"""team members, publisher role, email template

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-30

Idempotent: migration 0001 builds tables from the *current* models with
create_all(), so on a brand-new database the columns/tables below already exist.
Each step only runs if it is still missing (i.e. on databases created before this change).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

USER_COLUMNS = [
    ("first_name", sa.Column("first_name", sa.String(100))),
    ("last_name", sa.Column("last_name", sa.String(100))),
    ("must_change_password", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false")),
    ("invited_by", sa.Column("invited_by", UUID(as_uuid=False))),
    ("invite_token_hash", sa.Column("invite_token_hash", sa.String(128))),
    ("invite_expires_at", sa.Column("invite_expires_at", sa.DateTime(timezone=True))),
    ("invite_accepted_at", sa.Column("invite_accepted_at", sa.DateTime(timezone=True))),
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE rolename ADD VALUE IF NOT EXISTS 'PUBLISHER'")
        op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'USER_UPDATED'")
        op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'USER_DELETED'")

    inspector = sa.inspect(op.get_bind())
    existing_cols = {c["name"] for c in inspector.get_columns("users")}
    for name, column in USER_COLUMNS:
        if name not in existing_cols:
            op.add_column("users", column)
    if "ix_users_invite_token_hash" not in {i["name"] for i in inspector.get_indexes("users")}:
        op.create_index("ix_users_invite_token_hash", "users", ["invite_token_hash"])

    if "email_templates" not in inspector.get_table_names():
        op.create_table(
            "email_templates",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("brand_name", sa.String(100)),
            sa.Column("logo_file", sa.String(255)),
            sa.Column("accent_color", sa.String(20)),
            sa.Column("subject", sa.String(255)),
            sa.Column("heading", sa.String(255)),
            sa.Column("intro", sa.Text()),
            sa.Column("bullets", JSONB()),
            sa.Column("instructions", sa.Text()),
            sa.Column("button_text", sa.String(100)),
            sa.Column("expiry_note", sa.String(255)),
            sa.Column("footer", sa.String(255)),
        )


def downgrade() -> None:
    op.drop_table("email_templates")
    op.drop_index("ix_users_invite_token_hash", table_name="users")
    for name, _ in reversed(USER_COLUMNS):
        op.drop_column("users", name)
