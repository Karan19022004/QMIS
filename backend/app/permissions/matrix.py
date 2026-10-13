"""25 frontend roles plus Managing Director and Finance Assistant."""

FRONTEND_ROLES: list[tuple[str, str]] = [
    ("superadmin", "Super Admin"),
    ("admin", "Admin"),
    ("student", "Student"),
    ("parent", "Parent"),
    ("librarian", "Librarian"),
    ("prm", "PRM"),
    ("gatekeeper", "Gate Keeper"),
    ("gatekeepermanager", "Gate Keeper Manager"),
    ("director", "Director"),
    ("principal", "Principal"),
    ("canteenmanager", "Canteen Manager"),
    ("itsupportmanager", "IT Support Manager"),
    ("stationerystoremanager", "Stationery Store Manager"),
    ("housekeepingmanager", "Housekeeping Manager"),
    ("transportmanager", "Transport Manager"),
    ("teacher", "Teacher"),
    ("coordinator", "Coordinator"),
    ("jointdirector", "Joint Director"),
    ("jointdirectorassistant", "Joint Director Assistant"),
    ("jointdirectoraudit", "Joint Director Audit"),
    ("processauditor", "Process Auditor"),
    ("qualityauditor", "Quality Auditor"),
    ("hr", "HR"),
    ("accounthead", "Account Head"),
    ("driver", "Driver"),
]

MD_EXTRA_ROLES: list[tuple[str, str]] = [
    ("managing_director", "Managing Director"),
    ("finance_assistant", "Finance Assistant"),
]

ALL_ROLES = FRONTEND_ROLES + MD_EXTRA_ROLES

PERMISSIONS: list[tuple[str, str]] = [
    ("auth.me", "Read own session"),
    ("masters.read", "View classes and subjects"),
    ("masters.write", "Create classes and subjects"),
    ("audit.read", "View audit log"),
    ("hr.employees.read", "View HR employees"),
    ("hr.employees.write", "Create HR employees"),
    ("hr.read", "View HR records"),
    ("hr.write", "Change HR records"),
    ("hr.self", "View own staff profile, leave, attendance, and payslip"),
    ("admissions.write", "Create enquiries and enroll students"),
    ("students.read", "View students and guardians"),
    ("attendance.read", "View class attendance"),
    ("attendance.write", "Mark class attendance"),
    ("lessonplans.read", "View lesson plans (own, or all for approvers)"),
    ("lessonplans.write", "Create, edit, submit and revise own lesson plans"),
    ("lessonplans.remind", "Trigger lesson-plan deadline reminders"),
    ("exams.read", "View exam types, schedules, weightage and published results"),
    ("exams.write", "Create and submit exam schedules"),
    ("exams.configure", "Configure exam types and weightage (DA)"),
    ("marks.read", "View marks batches"),
    ("marks.write", "Enter, submit and revise marks"),
    ("results.read", "View published results of a student"),
    ("leave.read", "View own leave requests and requests received for approval"),
    ("leave.write", "File leave and permission requests"),
    ("leave.decide", "Approve or deny leave requests at your level"),
    ("escalations.read", "View escalations you raised or received"),
    ("escalations.write", "Raise an escalation to the next level"),
    ("escalations.resolve", "Move received escalations to In Review / Resolved / Rejected / Closed"),
    ("escalations.sweep", "Run the 24h escalation clock (auto-escalate overdue items)"),
    ("tasks.read", "View tasks assigned to you or by you"),
    ("tasks.write", "Assign tasks and update the status of your own tasks"),
    ("approvals.submit", "Submit items into the approval chain"),
    ("approvals.decide", "Approve or deny items at your level"),
    ("approvals.read", "View approval inbox and history"),
    ("notifications.read", "View own in-app notifications"),
    ("finance.read", "View finance fees, receipts, and books"),
    ("finance.collect", "Collect fees and send receipts (operational)"),
    ("finance.write", "Change finance masters, fee structures, and snapshot config"),
    ("finance.approve", "Approve finance requests and apply Head-only actions"),
    ("users.read", "View staff logins created by administrators"),
    ("users.write", "Create staff logins, change their status, and reset their passwords"),
    ("rbac.read", "View roles and the permissions each role holds"),
]

ALL_PERMISSION_CODES = [code for code, _ in PERMISSIONS]

_CORE = ["auth.me", "masters.read", "hr.self"]
_ADMIN = ALL_PERMISSION_CODES
_HR = ["auth.me", "hr.employees.read", "hr.employees.write", "hr.read", "hr.write", "hr.self", "students.read"]
_ADMISSIONS = ["auth.me", "masters.read", "admissions.write", "students.read"]
# accounthead = Finance Head (role code preserved for frontend Account Head portal)
_FINANCE_HEAD = [
    "auth.me",
    "masters.read",
    "finance.read",
    "finance.collect",
    "finance.write",
    "finance.approve",
    "students.read",
    "audit.read",
]
# Operational collector — cannot change masters or approve
_FINANCE_ASSISTANT = [
    "auth.me",
    "masters.read",
    "finance.read",
    "finance.collect",
    "students.read",
]

_STAFF_STUDENTS = list(dict.fromkeys([*_CORE, "students.read"]))
_STAFF_ATTENDANCE = list(
    dict.fromkeys([*_STAFF_STUDENTS, "attendance.read", "attendance.write"])
)

_APPROVALS = ["approvals.submit", "approvals.decide", "approvals.read", "notifications.read"]
_STAFF_ACADEMIC = list(
    dict.fromkeys(
        [
            *_STAFF_ATTENDANCE,
            *_APPROVALS,
            "lessonplans.read",
            "lessonplans.write",
            "exams.read",
            "marks.read",
            "marks.write",
            "results.read",
        ]
    )
)

ROLE_PERMISSIONS: dict[str, list[str]] = {code: list(_CORE) for code, _ in ALL_ROLES}
ROLE_PERMISSIONS.update(
    {
        "superadmin": list(_ADMIN),
        "admin": list(_ADMIN),
        "managing_director": list(_ADMIN),
        "prm": list(_ADMISSIONS),
        "accounthead": list(_FINANCE_HEAD),
        "finance_assistant": list(_FINANCE_ASSISTANT),
        # Staff UIS + class attendance (P1-5 / Y-1)
        "teacher": list(_STAFF_ACADEMIC),
        "coordinator": [*_STAFF_ACADEMIC, "exams.write"],
        "principal": [*_STAFF_ACADEMIC, "lessonplans.remind", "exams.write"],
        "director": [*_STAFF_ACADEMIC, "lessonplans.remind", "exams.configure"],
        "parent": [*_CORE, "results.read"],
        "jointdirector": list(_STAFF_ACADEMIC),
        "stationerystoremanager": list(dict.fromkeys([*_CORE, *_APPROVALS])),
        "hr": list(dict.fromkeys([*_HR, "approvals.submit", "approvals.read", "notifications.read"])),
    }
)

# Leave (Y-4): every staff role files and views its own requests; department heads and HR decide.
_NON_STAFF_ROLES = {"student", "parent"}
_LEAVE_DECIDERS = {
    "coordinator", "principal", "director", "jointdirector", "hr", "gatekeepermanager", "transportmanager",
}
for _code, _perms in ROLE_PERMISSIONS.items():
    if _code in _NON_STAFF_ROLES:
        continue
    for _p in ("leave.read", "leave.write", "notifications.read"):
        if _p not in _perms:
            _perms.append(_p)
    if _code in _LEAVE_DECIDERS and "leave.decide" not in _perms:
        _perms.append("leave.decide")

# Escalations + tasks (Y-5): the escalation hierarchy includes students (-> teacher); parents have no escalation path.
for _code, _perms in ROLE_PERMISSIONS.items():
    if _code == "parent":
        continue
    for _p in ("escalations.read", "escalations.write", "escalations.resolve", "notifications.read"):
        if _p not in _perms:
            _perms.append(_p)
    if _code not in _NON_STAFF_ROLES:
        for _p in ("tasks.read", "tasks.write"):
            if _p not in _perms:
                _perms.append(_p)
