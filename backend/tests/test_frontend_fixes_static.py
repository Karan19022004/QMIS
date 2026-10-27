"""Guards for frontend fixes that have no JS test runner (see test_frontend_student_database_static.py).

Most checks read the React sources. The fee maths is executed for real through `jiti`
(already in node_modules) and is skipped when Node is not available.
"""

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"


def _read(rel: str) -> str:
    return (SRC / rel).read_text(encoding="utf-8")


def _code(rel: str) -> str:
    """Source without line comments, so commented-out code cannot satisfy a check."""
    return "\n".join(line for line in _read(rel).splitlines() if not line.lstrip().startswith("//"))


# --- pages that crashed on load -------------------------------------------------------------


def test_assets_inventory_imports_the_helpers_it_calls():
    code = _code("Pages/JointDirectorAssistant/AssetsInventory/AssetsInventoryOverview.jsx")
    assert "getJdAssets" in code.split("from './assetsInventoryData'")[0]
    assert "ASSETS_INVENTORY" not in code


def test_template_versioning_hooks_are_not_inside_a_plain_function():
    code = _code("Pages/JointDirectorAudit/AuditConfiguration/TemplateVersioning/TemplateVersioningList.jsx")
    format_today = code[code.index("const formatToday") : code.index("const TemplateVersioningList")]
    assert "useState" not in format_today and "useEffect" not in format_today
    assert "TEMPLATE_VERSIONS" not in code


@pytest.mark.parametrize(
    ("rel", "constant", "saver"),
    [
        ("Pages/JointDirectorAudit/AuditConfiguration/VisibilityRules/VisibilityRulesList.jsx", "VISIBILITY_RULES", "saveAuditVisibilityRules"),
        ("Pages/JointDirectorAudit/AuditConfiguration/WorkflowRules/WorkflowRulesList.jsx", "WORKFLOW_RULES", "saveAuditWorkflowRules"),
    ],
)
def test_audit_rule_pages_use_imported_getters_and_persist(rel, constant, saver):
    code = _code(rel)
    assert not re.search(rf"\b{constant}\b", code)
    assert saver in code


# --- admissions ----------------------------------------------------------------------------


def test_admission_form_sends_the_student_portal_login():
    code = _code("services/admissionsApi.js")
    assert "student_account_email:" in code
    assert "student_account_password:" in code


def test_admission_transport_fields_accept_typed_values():
    code = _code("Pages/Admin/FrontOffice/AdminssionList/Components/TransportInfo.jsx")
    assert code.count("<datalist") == 2
    assert code.count("maxLength={80}") == 2


# --- student lists -------------------------------------------------------------------------


@pytest.mark.parametrize(
    "rel",
    [
        "Pages/Admin/UserManagement/StudentDatabase/StudentsList.jsx",
        "Pages/Teacher/StudentsList/StudentsList.jsx",
        "Pages/Coordinator/StudentsList/StudentsList.jsx",
    ],
)
def test_student_list_pages_use_the_shared_filtered_view(rel):
    assert "<StudentDatabaseListView" in _code(rel)


def test_employee_list_reads_rows_from_directory_records():
    # loadEmployeeDirectory returns { row, detail } pairs; storing the pairs left every cell blank.
    code = _code("Common/UserDatabase/EmployeeDatabaseListView.jsx")
    assert "setEmployees(records)" not in code
    assert "map(({ row, detail })" in code


def test_teacher_roster_never_shows_demo_teachers_in_server_mode():
    code = _code("Pages/Principal/TeacherAllocation/teacherAllocationData.js")
    getter = code[code.index("export const getTeachers") : code.index("export const setTeacherRoster")]
    assert "if (canUseEmployeeDirectoryApi()) return []" in getter
    assert "director" in code[code.index("export const isAllocatableTeacherRecord") : code.index("export const mapDirectoryRecordToTeacher")]


def test_shared_student_list_filters_are_applied_to_rows():
    code = _code("Common/UserDatabase/StudentDatabaseListView.jsx")
    for name in ("classFilter", "sectionFilter", "genderFilter", "statusFilter"):
        assert re.search(rf"if \({name} &&", code), name
    assert "pageRows.map" in code


# --- promotion -----------------------------------------------------------------------------


def test_bulk_promotion_is_sequential_and_capped():
    code = _code("Pages/Coordinator/StudentPlacement/PromoteStudents.jsx")
    assert "MAX_BATCH" in code
    assert "Promise.all" not in code  # roll numbers are assigned per request; no parallel promotes
    assert "await promoteStudentApi" in code
    assert "Select all" in code


# --- fees ----------------------------------------------------------------------------------


def test_payment_link_is_awaited_before_the_modal_opens():
    code = _code("Pages/AccountHead/FeesManagement/Components/FeeCollectionTab.jsx")
    assert "await generatePaymentLink" in code
    assert "setLink(generatePaymentLink" not in code


def test_route_transport_fees_are_not_billed_to_every_student():
    assert "isRouteBilledFee(row)" in _code("Pages/AccountHead/financeDomain/financeBootstrap.js")
    context = _code("Pages/AccountHead/financeDomain/FinanceContext.jsx")
    assert "routeBilled ? []" in context
    assert "if (routeBilled) return baseInstallments" in context


JITI_CLI = ROOT / "node_modules" / "jiti" / "lib" / "jiti-cli.mjs"
JITI = bool(shutil.which("node")) and JITI_CLI.exists()

FEE_SCRIPT = """
const path = require('path');
const src = process.env.QMIS_SRC;
const { buildPaymentSchedule } = require(path.join(src, 'Pages/AccountHead/FeesManagement/feePaymentSchedule.js'));
const { resolveConcessionAmount } = require(path.join(src, 'Pages/AccountHead/financeDomain/financeHelpers.js'));
const cases = [[10000, 'TERM_WISE'], [25000, 'MONTHLY'], [9999, 'QUARTERLY'], [12000, 'ONE_TIME']];
const splits = cases.map(([amount, frequency]) => (
  buildPaymentSchedule({ amount, frequency, academicYear: '2026-2027' }).parts.map((p) => p.amount)
));
const ins = { studentId: 'S1', feeCategoryId: 'CAT-TUITION', academicYear: '2026-2027', feeAmount: 3000 };
const base = { studentId: 'S1', feeCategoryId: 'CAT-TUITION', status: 'Approved' };
const concessions = {
  percent: resolveConcessionAmount(ins, [{ ...base, amount: 50, amountType: 'PERCENT' }]),
  flat: resolveConcessionAmount(ins, [{ ...base, amount: 200 }]),
  stored: resolveConcessionAmount({ ...ins, concessionAmount: 10 }, []),
};
const terms = [3334, 3333, 3333].map((feeAmount, index) => ({ ...ins, id: `T${index}`, scheduleIndex: index, feeAmount }));
concessions.yearlyFlat = terms.map((row) => resolveConcessionAmount(row, [{ ...base, amount: 3000 }], terms));
process.stdout.write(JSON.stringify({ cases, splits, concessions }));
"""


@pytest.fixture(scope="module")
def fee_results(tmp_path_factory):
    if not JITI:
        pytest.skip("Node / jiti not available")
    script = tmp_path_factory.mktemp("fee") / "fee_check.cjs"
    script.write_text(FEE_SCRIPT, encoding="utf-8")
    out = subprocess.run(
        ["node", str(JITI_CLI), str(script)],
        cwd=ROOT,
        env={**os.environ, "QMIS_SRC": str(SRC)},
        capture_output=True,
        text=True,
        timeout=120,
    )
    if out.returncode != 0:
        pytest.fail(out.stderr[-2000:])
    return json.loads(out.stdout)


def test_fee_instalments_are_whole_rupees_and_add_up(fee_results):
    for (amount, frequency), parts in zip(fee_results["cases"], fee_results["splits"]):
        assert sum(parts) == amount, frequency
        assert all(float(p).is_integer() for p in parts), frequency
    assert fee_results["splits"][0] == [3334, 3333, 3333]


def test_percent_concession_is_a_share_of_the_instalment(fee_results):
    concessions = fee_results["concessions"]
    assert {k: concessions[k] for k in ("percent", "flat", "stored")} == {"percent": 1500, "flat": 200, "stored": 10}


def test_flat_concession_is_a_yearly_amount_spread_over_the_instalments(fee_results):
    shares = fee_results["concessions"]["yearlyFlat"]
    assert sum(shares) == 3000
    assert shares == [1002, 999, 999]


# --- academics -----------------------------------------------------------------------------


def test_class_timetable_filters_match_every_period():
    code = _code("Pages/Principal/ClassTimetable/ClassTimetableList.jsx")
    assert "periodsOf(record).some" in code
    assert "pageRecords.map" in code


def test_routes_removed_by_the_snapshot_commit_are_back():
    coordinator = _read("Routes/CoordinatorRoutes.jsx")
    for path in ("/coordinator/student-placement", "/coordinator/student-placement/promote",
                 "/coordinator/class/class-timetable", "/coordinator/class/edit-class-timetable/:id"):
        assert f'path="{path}"' in coordinator, path
    sidebar = _read("Common/CommonSidebar/Components/sidebarLinks.js")
    assert 'to: "/director/class-timetable-approvals"' in sidebar
    assert 'to: "/coordinator/student-placement"' in sidebar
    assert 'to: "/coordinator/class/class-timetable"' in sidebar


def test_principal_edit_timetable_route_exists():
    assert 'path="/principal/edit-class-timetable/:id"' in _read("Routes/PrincipalRoutes.jsx")


def test_student_daily_timetable_reads_cells_by_slot_label():
    code = _code("Pages/Student/Class/TimeTableDetails.jsx")
    assert "schedule?.[slot.label]" in code
    assert "approved.length ? approved : timetables" not in code  # never fall back to unapproved


def test_weekly_timetable_dates_follow_the_weekday_name():
    assert "WEEKDAY_OFFSETS[" in _code("Pages/Student/Components/WeeklyTimetable.jsx")


def test_attendance_page_has_no_hardcoded_figures():
    code = _code("Pages/Student/Class/AttendanceDetails.jsx")
    assert "subjectWiseAttendance" not in code
    assert "May 2025" not in code
    assert ">22<" not in code and "81.82%" not in code


def test_biometric_saves_never_write_an_empty_list_before_loading():
    code = _code("Common/demoDomain/biometric.js")
    sync = code[code.index("export async function syncBiometricDemo") : code.index("export async function overrideAttendance")]
    assert "await loadedRows()" in sync
    assert "if (!rows.length)" in sync
    override = code[code.index("export async function overrideAttendance") :]
    assert "await loadedRows()" in override
    assert "rows.some((row) => row.id === id)" in override


def test_portal_profiles_keep_placement_status():
    # Without it every placed student saw "Awaiting section assignment" on timetable/attendance.
    assert "placementStatus: row.placementStatus" in _code("services/studentsApi.js").split("export function mapStudentListFromApi")[0]
    assert "placementStatus: row.placementStatus" in _code("services/parentsApi.js")


def test_lesson_plans_enter_approval_and_decisions_are_saved_on_the_server():
    code = _code("Common/LessonPlanApproval/lessonPlanApprovalData.js")
    add = code[code.index("export const addLessonPlan") : code.index("export const addLessonPlans")]
    assert "await submitLessonPlanApi(created.id)" in add
    decide = code[code.index("export const updateLessonPlanStatus") : code.index("export const getSummaryCounts")]
    assert "decideLessonPlanApi(plan.approvalId" in decide
    done = code[code.index("export const markLessonPlanAsDone") : code.index("export const emptyLessonPlanFilters")]
    assert "completeLessonPlanApi(id" in done
    assert "<LessonPlanTabs />" in _code("Pages/Teacher/LessonPlanApproval/SubmitLessonPlan.jsx")
    assert "<LessonPlanTabs />" in _code("Pages/Teacher/LessonPlanApproval/MyLessonPlan.jsx")


def test_star_of_month_matrix_saves_each_class_to_the_server():
    code = _code("Common/StudentStarRatings/somChecklist.js")
    upsert = code[code.index("export const upsertRating") : code.index("export const studentScore")]
    assert "pushContext(context)" in upsert
    assert "upsertOpsItemApi(collection, id, body)" in code
    assert "hydrateSomFromApi()" in _code("Common/StudentStarRatings/SomMatrixPage.jsx")


def test_admission_form_round_trips_the_referral():
    code = _code("services/admissionsApi.js")
    assert "referral_name: String(form.referralName" in code
    assert "referralName: row.referral_name" in code
    assert "<ReferralInfo" in _code("Pages/Admin/FrontOffice/AdminssionList/AddAdmission.jsx")


def test_new_admin_pages_are_routed():
    admin = _read("Routes/AdminRoutes.jsx")
    assert 'path="/admin/file-management"' in admin and 'path="/admin/camera-management"' in admin
    assert 'path="/account-head/admission-referrals"' in _read("Routes/AccountHeadRoutes.jsx")


def test_notification_bell_links_only_to_existing_pages():
    code = _code("Common/CommonHeader/Components/UserNotifications.jsx")
    assert "NOTIFICATION_PAGE_SEGMENTS" in code
    assert "segment === 'dashboard'" in code
