import { apiRequest, getAccessToken, isApiAdminAttendanceEnabled } from './apiClient'
import { listAttendanceApi } from './attendanceApi'
import { listStudentsApi } from './studentsApi'

/** True when the Administrator attendance lists should read the server (flag on + real session). */
export const canUseAdminAttendanceApi = () => isApiAdminAttendanceEnabled() && Boolean(getAccessToken())

const DASH = '—'
const NOT_MARKED = 'Not marked'

const pad = (value) => String(value).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (never toISOString: that shifts the day for users east of UTC). */
export const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * HR attendance rows were written in two date formats (dd-mm-yyyy by the HR screens, ISO by
 * others). Returns YYYY-MM-DD, or '' when the value is not a recognised date.
 */
export const normalizeAttendanceDate = (value) => {
    const text = String(value ?? '').trim()
    let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text)
    if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`
    return ''
}

const clockOrDash = (value) => {
    const text = String(value ?? '').trim()
    return /\d/.test(text) ? text : DASH // HR stores "—" (sometimes mis-encoded) when nobody punched
}

const timeOfDay = (iso) => {
    const parsed = iso ? new Date(iso) : null
    if (!parsed || Number.isNaN(parsed.getTime())) return DASH
    return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const byNumberedName = (a, b) => a.localeCompare(b, undefined, { numeric: true })
const uniqueSorted = (values) => [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))].sort(byNumberedName)
const failure = (result) => (result.status === 'rejected' ? result.reason?.message || 'Request failed.' : '')

/**
 * Student attendance for one date. With a class (and no section) the roster is requested, so
 * students nobody marked yet appear as "Not marked". With a section the API only returns marked
 * students (its roster does not know a student's section), so the roster is not used then.
 *
 * Class and section choices come from the masters API and the enrolled students; if either list
 * fails the attendance is still shown with a warning.
 */
export const loadStudentAttendance = async ({ date, className = '', section = '' }) => {
    const roster = Boolean(className) && !section
    const [marks, classes, sections, students] = await Promise.all([
        listAttendanceApi({ date, className, section, roster }),
        ...[
            apiRequest('/masters/classes'),
            apiRequest('/masters/sections'),
            listStudentsApi(),
        ].map((request) => request.then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }))),
    ])

    const warnings = []
    if (classes.status === 'rejected') warnings.push(`The class list could not be loaded (${failure(classes)}).`)
    if (sections.status === 'rejected') warnings.push(`The section list could not be loaded (${failure(sections)}).`)

    const records = marks.map((row) => {
        const status = row.attendanceStatus || NOT_MARKED
        return {
            id: `${row.studentId}:${row.date}`,
            studentId: String(row.studentId),
            admissionNo: row.admissionNumber || DASH,
            studentName: row.studentName || DASH,
            className: row.className || DASH,
            section: row.section || DASH,
            markedAt: row.attendanceStatus ? timeOfDay(row.time) : DASH,
            inOut: row.inOutStatus || DASH,
            status,
        }
    })

    const masterClasses = classes.status === 'fulfilled' ? classes.value.map((item) => item.name) : []
    const masterSections = sections.status === 'fulfilled' ? sections.value.map((item) => item.name) : []
    const studentClasses = students.status === 'fulfilled' ? students.value.map((item) => item.className) : []
    return {
        records,
        warnings,
        classOptions: uniqueSorted([...masterClasses, ...studentClasses, ...marks.map((row) => row.className)]),
        sectionOptions: uniqueSorted([...masterSections, ...marks.map((row) => row.section)]),
    }
}

/**
 * Employee attendance: the HR attendance collection joined to HR employees by employee id. The
 * collection has no date filter, so every record is returned and the screen filters by date.
 * Names and roles are optional: without the employee list the IDs are still shown, with a warning.
 */
export const loadEmployeeAttendance = async () => {
    const [attendance, employees] = await Promise.allSettled([
        apiRequest('/hr/attendance'),
        apiRequest('/hr/portal/employees'),
    ])
    if (attendance.status === 'rejected') throw attendance.reason

    const warnings = []
    if (employees.status === 'rejected') {
        warnings.push(`Employee names and roles could not be loaded (${failure(employees)}); employee IDs are shown instead.`)
    }
    const byId = new Map(
        (employees.status === 'fulfilled' ? employees.value : []).map((item) => [String(item.id), item]),
    )

    const records = (Array.isArray(attendance.value) ? attendance.value : []).map((item, index) => {
        const employee = byId.get(String(item.employeeId))
        return {
            id: String(item.id ?? `row-${index}`),
            employeeId: String(item.employeeId || DASH),
            employeeName: employee?.name || DASH,
            role: employee?.role || employee?.designation || DASH,
            date: normalizeAttendanceDate(item.date),
            punchInTime: clockOrDash(item.punchIn) !== DASH ? clockOrDash(item.punchIn) : clockOrDash(item.checkIn),
            punchOutTime: clockOrDash(item.punchOut) !== DASH ? clockOrDash(item.punchOut) : clockOrDash(item.checkOut),
            status: String(item.status || DASH),
            source: String(item.source || ''),
        }
    })
    return {
        records,
        warnings,
        roleOptions: uniqueSorted(records.map((record) => (record.role === DASH ? '' : record.role))),
        statusOptions: uniqueSorted(records.map((record) => (record.status === DASH ? '' : record.status))),
    }
}
