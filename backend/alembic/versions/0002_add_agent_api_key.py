"""add api_key to agents

Revision ID: 0002_add_agent_api_key
Revises: 0001_initial
Create Date: 2026-05-26
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_add_agent_api_key"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("api_key", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "api_key")
