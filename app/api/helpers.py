"""
FILE: app/api/helpers.py

Responsibility:
  Shared utility functions for all route modules.
  default_user_id(), normalize_tags().

MUST NOT:
  - Import from route modules or AI modules
  - Access database directly

Depends on:
  - auth.get_current_user_id (session-based auth)
"""


from ..auth import get_current_user_id


def default_user_id():
    """Return the authenticated user's ID from the session cookie.
    Aborts with 401 if no valid session is found.
    This is the single choke-point: every route file calls this."""
    return get_current_user_id()


def normalize_tags(value):
    """Deduplicate and normalise a list of tag strings."""
    if not isinstance(value, list):
        return []
    out = []
    seen = set()
    for raw in value:
        tag = str(raw or "").strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        out.append(tag)
    return out
