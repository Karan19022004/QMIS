# PRM (Front Office) — next steps (not started)

**Gate:** Administrator modules stabilised (14 Oct 2026). Do not start PRM code until this hand-off is accepted.

## Order of work (one module at a time)

1. **Admission Enquiry** — wire `src/Pages/FrontOffice/AdmissionEnquiry` to existing `admissionsApi.js` / `/admissions/enquiries` with `VITE_USE_API_ADMISSIONS=true`. Preserve UI.
2. **Admission List** — same admissions stack as Admin.
3. **Student / Teacher lists** — reuse students (and read-only staff lists where already backed).
4. **TC Request** — reuse `/tc-requests` with PRM permissions.
5. **PRM-only** (new or local today): Student Transfer, Re-Enrollment, Gate Pass / Hostel / Material / Goods Received — inventory APIs before writing migrations.
6. Shared already-on-API: Leave, Escalations, Announcements, Communication, Notifications, Attendance (confirm flags + role permissions).

## Rules

- Keep Front Office UI/design.
- Prefer existing Admin/campus APIs; add tables only when PRM-only flows need them.
- After each module: pytest + short browser check + update daily report (md + PDF).
- Refresh Archify when new routers mount in `main.py`.
