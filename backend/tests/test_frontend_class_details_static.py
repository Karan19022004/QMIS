"""Static guards for the Admin > Class > Class Details frontend (API mode).

There is no JS test runner in the project, so these read the React sources. Runtime behaviour is
covered by the browser checks recorded in reports/testing-report.md.
"""

import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "src"
DETAILS = "Pages/Admin/Class/ClassDetails/"


def _read(relative: str) -> str:
    return (SRC / relative).read_text(encoding="utf-8")


def test_service_uses_only_existing_masters_routes_and_never_touches_storage():
    source = _read("services/classDetailsApi.js")
    assert "localStorage" not in source and "sessionStorage" not in source
    routes = set(re.findall(r"/masters/[a-z-]+", source))
    assert routes == {"/masters/academic-years", "/masters/classes", "/masters/sections"}
    # the API has no class update or delete, so the client must not try one
    assert "method: 'DELETE'" not in source and "method: 'PATCH'" not in source and "method: 'PUT'" not in source


def test_year_filter_goes_to_the_server_and_only_the_complete_list_is_mirrored():
    source = _read("services/classDetailsApi.js")
    assert "academic_year_id=${encodeURIComponent(academicYearId)}" in source
    assert "if (!filtered) mirrorApiClassDetails(records)" in source


def test_save_is_idempotent_and_treats_a_conflict_as_already_present():
    source = _read("services/classDetailsApi.js")
    # looks the class up by name before creating, so a retry never fails with "class exists"
    assert source.index("existingClasses") < source.index("method: 'POST', body }")
    assert "error?.status === 409" in source
    assert "sectionsExisting" in source and "failures" in source


def test_flag_defaults_to_the_auth_flag_and_can_turn_the_screen_back_to_local():
    client = _read("services/apiClient.js")
    block = client[client.index("export const isApiClassDetailsEnabled") :]
    block = block[: block.index("export const getAccessToken")]
    assert "VITE_USE_API_CLASSES" in block and "isApiAuthEnabled()" in block


def test_mirror_keeps_local_only_fields_and_never_removes_classes():
    source = _read("Common/RBAC/academicsCatalogData.js")
    body = source[source.index("export const mirrorApiClassDetails") : source.index("export const removeClassDetails")]
    assert "...local," in body  # teacher/capacity/room survive for a class with the same name
    assert "filter(" not in body and "splice" not in body  # no deletions; the API cannot delete classes
    assert "if (JSON.stringify(catalog) !== before) saveCatalog(catalog)" in body
    assert "password" not in body.lower()


def test_list_page_hides_unsupported_columns_and_actions_in_api_mode():
    page = _read(DETAILS + "ClassDetails.jsx")
    assert "useClassDirectory(yearId)" in page
    assert "directory.status === 'loading'" in page and "directory.status === 'error'" in page
    assert "directory.reload" in page  # Retry
    assert "Academic Year" in page
    # the capacity/teacher/room columns and the Edit/Delete menu live only in the local-mode branch
    local_branch = page[page.index("                                                    <>\n") :]
    assert "classCapacity" in local_branch and "removeClassDetails" in page
    api_cell = page[page.index("{apiMode ? (\n                                                    <td") :]
    api_cell = api_cell[: api_cell.index(") : (")]
    assert "classTeacher" not in api_cell and "Delete" not in api_cell and "Edit" not in api_cell


def test_add_page_hides_unsupported_inputs_and_saves_through_the_service_in_api_mode():
    page = _read(DETAILS + "AddClassDetails.jsx")
    assert "saveClassWithSections" in page and "showCapacity={!apiMode}" in page
    assert "saveClassDetails" in page  # local mode is unchanged
    assert "if (apiMode) return undefined" in page  # no user sync just to fill a hidden teacher picker
    assert "disabled={saving}" in page  # no double submit
    info = _read(DETAILS + "Components/ClassInfo.jsx")
    assert "apiMode ? null : (<>" in info  # teacher, capacity and room only render in local mode


def test_hook_derives_loading_from_the_request_key_not_from_set_state_in_the_effect():
    hook = _read(DETAILS + "useClassDirectory.js")
    assert "result.key === requestKey" in hook
    effect = hook[hook.index("useEffect(") :]
    assert "setResult({" in effect and ".then(" in effect  # only inside the promise callbacks
    assert "setResult" not in effect[: effect.index("loadClassDirectory(")]
