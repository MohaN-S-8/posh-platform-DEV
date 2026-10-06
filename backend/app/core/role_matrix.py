from sqlalchemy import text

# Copy the existing access once, then keep both roles independent.
SEED_COPARTNER = text(
    """
    INSERT INTO posh_role_access
        (role_label, access_item, access_status, is_allowed, display_order)
    SELECT 'Co-Partner', access_item, access_status, is_allowed, display_order
    FROM posh_role_access
    WHERE role_label = 'Super Admin'
      AND NOT EXISTS (SELECT 1 FROM (SELECT role_label FROM posh_role_access) AS existing
                      WHERE existing.role_label = 'Co-Partner')
"""
)
