"""align roles to user management pdf

Revision ID: c2b7f83d9a12
Revises: 9b8f0c2d7a61
Create Date: 2026-07-06 00:00:00.000000
"""

from alembic import op

revision = "c2b7f83d9a12"
down_revision = "9b8f0c2d7a61"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO role_master (role_id, role_name)
        VALUES
            (1, 'Super Admin'),
            (2, 'Admin'),
            (3, 'Client / Management'),
            (4, 'HR / IC'),
            (5, 'Employee')
        ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)
        """
    )
    op.execute(
        """
        UPDATE user_master
        SET role_id = 5
        WHERE role_id = 4
          AND email NOT IN ('hr@posh.com')
        """
    )
    op.execute(
        """
        UPDATE user_master
        SET role_id = 4
        WHERE role_id = 3
           OR email = 'hr@posh.com'
        """
    )


def downgrade() -> None:
    op.execute("UPDATE user_master SET role_id = 4 WHERE role_id = 5")
    op.execute("UPDATE user_master SET role_id = 3 WHERE role_id = 4 AND email = 'hr@posh.com'")
    op.execute("UPDATE role_master SET role_name = 'Company Admin' WHERE role_id = 2")
    op.execute("UPDATE role_master SET role_name = 'HR' WHERE role_id = 3")
    op.execute("UPDATE role_master SET role_name = 'Employee' WHERE role_id = 4")
    op.execute("DELETE FROM role_master WHERE role_id = 5")
