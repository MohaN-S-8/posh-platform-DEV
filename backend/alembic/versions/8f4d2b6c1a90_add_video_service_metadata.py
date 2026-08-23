"""add video service metadata

Revision ID: 8f4d2b6c1a90
Revises: 9b8f0c2d7a61
Create Date: 2026-08-23 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f4d2b6c1a90"
down_revision: Union[str, None] = "9b8f0c2d7a61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "video_master",
        sa.Column("service_code", sa.String(length=50), nullable=True, server_default="POSH"),
    )
    op.add_column(
        "video_master",
        sa.Column("training_level", sa.String(length=50), nullable=True, server_default="Basic"),
    )
    op.add_column(
        "video_master",
        sa.Column(
            "target_audience",
            sa.String(length=50),
            nullable=True,
            server_default="Employee",
        ),
    )


def downgrade() -> None:
    op.drop_column("video_master", "target_audience")
    op.drop_column("video_master", "training_level")
    op.drop_column("video_master", "service_code")
