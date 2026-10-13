"""Static guards for the Admin > RBAC > User Creation frontend.

There is no JS test runner in the project, so these read the React sources. They prove a password
is never persisted by the API-backed path; runtime behaviour is covered by the browser checks.
"""

import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "src"


def _read(relative: str) -> str:
    return (SRC / relative).read_text(encoding="utf-8")


def test_api_service_never_touches_browser_storage():
    source = _read("services/adminUsersApi.js")
    assert "localStorage" not in source and "sessionStorage" not in source


def test_api_mirror_never_stores_a_password():
    source = _read("Common/RBAC/createdUsersData.js")
    mapper = source[source.index("const fromApiUser") : source.index("export const syncCreatedUsersFromApi")]
    assert "password: ''" in mapper
    assert "temporaryPassword" not in mapper
    # nothing in the API section persists the generated password
    api_section = source[source.index("API mode (Admin") :]
    assert not re.search(r"saveUsers\([^)]*temporaryPassword", api_section)
    assert "localStorage" not in api_section


def test_temporary_password_only_travels_in_router_state_and_is_cleared():
    page = _read("Pages/Admin/RBAC/UserCreationPage.jsx")
    assert "localStorage" not in page and "sessionStorage" not in page
    assert "state: null" in page  # the history entry is wiped after the one-time display
    create = _read("Pages/Admin/RBAC/CreateUserPage.jsx")
    assert "localStorage" not in create and "sessionStorage" not in create


def test_roles_page_is_read_only():
    page = _read("Pages/Admin/RBAC/RolesPage.jsx")
    assert "method: 'PATCH'" not in page and "setPermissionsForRole" not in page
    service = _read("services/adminUsersApi.js")
    assert "role" in service and "/permissions`, { method" not in service


def test_password_field_does_not_autofill_existing_credentials():
    assert "autoComplete='new-password'" in _read("Common/RBAC/Components/UserCreationForm.jsx")
