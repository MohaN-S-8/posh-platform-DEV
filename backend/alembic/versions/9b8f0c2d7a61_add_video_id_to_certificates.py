"""add video_id to certificates

Revision ID: 9b8f0c2d7a61
Revises: 71a229ca0ac3
Create Date: 2026-07-04 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "9b8f0c2d7a61"
down_revision: Union[str, None] = "71a229ca0ac3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("certificates", sa.Column("video_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_certificates_video_id_video_master",
        "certificates",
        "video_master",
        ["video_id"],
        ["video_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_certificates_video_id_video_master", "certificates", type_="foreignkey")
    op.drop_column("certificates", "video_id")
