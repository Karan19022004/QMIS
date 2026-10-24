/**
 * Bridge staff leave (Driver → TM → HR API/store) into HR Leave Management + attendance
 * so payroll LOP / leave days reflect approved absences.
 */
import {
    getLeaveBundle,
    saveLeaveBundle,
    getAttendance,
    saveAttendance,
    getEmployees,
    saveEmployees,
    getPayrollBundle,
    savePayrollBundle,
    nextId,
} from '../../Pages/HR/domain/hrStore'
import { PAYROLL_MONTHS } from '../../Pages/HR/domain/payrollConfig'
import { resolveDriverProfile } from '../../Pages/Driver/driverProfileData'
import { resolveRoleKey } from './leaveRequestConfigs'
import { ROLES } from '../../constants/roles'

const isoFromDmy = (value) => {
    const text = String(value || '').trim()
    const m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (m) {
        const [, d, mo, y] = m
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
    return ''
}

const dmyFromIso = (iso) => {
    const [y, m, d] = String(iso || '').slice(0, 10).split('-')
    if (!y || !m || !d) return ''
    return `${d}-${m}-${y}`
}

const eachDateInclusive = (fromIso, toIso) => {
    const start = new Date(`${fromIso}T00:00:00`)
    const end = new Date(`${toIso}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []
    const out = []
    const cursor = new Date(start)
    while (cursor <= end) {
        const y = cursor.getFullYear()
        const m = String(cursor.getMonth() + 1).padStart(2, '0')
        const d = String(cursor.getDate()).padStart(2, '0')
        out.push(`${y}-${m}-${d}`)
        cursor.setDate(cursor.getDate() + 1)
    }
    return out
}

/** Ensure a Transport / Driver HR employee row exists for payroll linkage. */
export function ensureHrEmployeeForLeave(request) {
    if (!request) return null
    const employees = getEmployees()
    const email = String(request.requestedByEmail || request.requestedBy || '').trim().toLowerCase()
    const driverId = String(request.employeeId || '').trim()
    const byEmail = email
        ? employees.find((row) => String(row.email || '').trim().toLowerCase() === email)
        : null
    const byId = driverId
        ? employees.find((row) => String(row.id || '') === driverId || String(row.employeeId || '') === driverId)
        : null
    if (byEmail || byId) return byEmail || byId

    const isDriver = resolveRoleKey(request.submitterRole) === ROLES.DRIVER
    const profile = isDriver ? resolveDriverProfile(email) : null
    const name = profile?.driverName
        || request.requestedByName
        || (email.includes('@') ? email.split('@')[0] : request.requestedBy)
        || 'Staff'
    const id = profile?.driverId && profile.driverId !== '—'
        ? profile.driverId
        : nextId('EMP', employees)

    const salaryRaw = String(profile?.profile?.salary || profile?.profile?.grossSalary || '')
    const salaryMatch = salaryRaw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
    const row = {
        id,
        name,
        email: email.includes('@') ? email : (profile?.driverEmail || ''),
        department: request.department || (isDriver ? 'Transport' : 'Support / Operations'),
        category: isDriver ? 'Driver' : (request.department || 'Administration'),
        designation: request.role || (isDriver ? 'School Driver' : 'Staff'),
        status: 'Active',
        role: isDriver ? 'Driver' : (request.role || 'Staff'),
        reportingManager: isDriver ? 'Transport Manager' : '',
        grossSalary: salaryMatch ? Number(salaryMatch[1]) : (isDriver ? 22000 : 28000),
        otherAllowance: 300,
        specialDeduction: 0,
        otherEmployerBenefits: 0,
        joiningDate: profile?.profile?.joiningDate || '',
        source: 'leave-bridge',
    }
    saveEmployees([row, ...employees.filter((item) => item.id !== row.id)])
    return row
}

export function upsertHrLeaveFromStaffRequest(request) {
    if (!request) return null
    const employee = ensureHrEmployeeForLeave(request)
    if (!employee) return null

    const fromIso = isoFromDmy(request.fromDate)
    const toIso = isoFromDmy(request.toDate) || fromIso
    const bundle = getLeaveBundle()
    const key = String(request.id || request.leaveRequestId || '')
    const existingIdx = (bundle.requests || []).findIndex((row) => (
        String(row.staffLeaveId || '') === key
        || String(row.id || '') === key
        || (String(row.leaveRequestId || '') === String(request.leaveRequestId || '') && request.leaveRequestId)
    ))

    const mapped = {
        id: existingIdx >= 0 ? bundle.requests[existingIdx].id : nextId('LVE', bundle.requests || []),
        staffLeaveId: key,
        leaveRequestId: request.leaveRequestId || key,
        employeeId: employee.id,
        employeeName: employee.name,
        leaveType: request.leaveType || 'Casual Leave',
        fromDate: fromIso,
        toDate: toIso,
        days: Number(request.totalDays) || eachDateInclusive(fromIso, toIso).length || 1,
        hours: request.hours ?? null,
        reason: request.reason || '',
        status: request.status || 'Pending',
        approvedBy: request.status === 'Approved'
            ? (request.approverRole === 'hr' ? 'HR' : 'Transport Manager / Dept Head')
            : '',
        department: employee.department,
        submitterRole: request.submitterRole || '',
        source: 'staff-leave',
    }

    const requests = [...(bundle.requests || [])]
    if (existingIdx >= 0) requests[existingIdx] = { ...requests[existingIdx], ...mapped }
    else requests.unshift(mapped)
    saveLeaveBundle({ ...bundle, requests })
    return mapped
}

/** Write Leave/Permission attendance days so payroll LOP picks them up. */
export function syncApprovedLeaveToAttendance(request) {
    if (!request || String(request.status || '') !== 'Approved') return false
    const employee = ensureHrEmployeeForLeave(request)
    if (!employee) return false

    const fromIso = isoFromDmy(request.fromDate)
    const toIso = isoFromDmy(request.toDate) || fromIso
    const days = eachDateInclusive(fromIso, toIso)
    if (days.length === 0) return false

    const isPermission = String(request.leaveType || '').toLowerCase().includes('permission')
    const attendanceStatus = isPermission ? 'Permission' : 'Leave'
    const leaveKey = String(request.id || request.leaveRequestId || '')
    let attendance = getAttendance().filter((row) => String(row.staffLeaveId || '') !== leaveKey)

    days.forEach((iso) => {
        attendance = [
            {
                id: `LVE-${leaveKey}-${iso}`,
                staffLeaveId: leaveKey,
                employeeId: employee.id,
                date: iso,
                status: attendanceStatus,
                source: 'Staff leave approval',
                checkIn: '—',
                checkOut: '—',
                punchIn: '',
                punchOut: '',
                leaveType: request.leaveType,
            },
            ...attendance.filter((row) => !(row.employeeId === employee.id && row.date === iso && row.source === 'Staff leave approval')),
        ]
    })

    // Mark employee On Leave when today is covered.
    const todayIso = new Date().toISOString().slice(0, 10)
    if (days.includes(todayIso)) {
        const employees = getEmployees().map((row) => (
            row.id === employee.id ? { ...row, status: 'On Leave' } : row
        ))
        saveEmployees(employees)
    }

    saveAttendance(attendance)
    return true
}

/** Roll approved leave days into HR payroll month counters (casualLeave / otherLeave / permission). */
export function applyApprovedLeaveToPayrollMonth(request, employee) {
    if (!request || !employee || String(request.status || '') !== 'Approved') return false
    const fromIso = isoFromDmy(request.fromDate)
    const toIso = isoFromDmy(request.toDate) || fromIso
    const days = eachDateInclusive(fromIso, toIso)
    if (days.length === 0) return false

    const leaveKey = String(request.id || request.leaveRequestId || '')
    const isPermission = String(request.leaveType || '').toLowerCase().includes('permission')
    const isCasual = String(request.leaveType || '').toLowerCase().includes('casual')
    const bucketKey = (month, year) => `${employee.id}|${month}|${year}`
    const counts = new Map()

    days.forEach((iso) => {
        const date = new Date(`${iso}T00:00:00`)
        if (Number.isNaN(date.getTime())) return
        const month = PAYROLL_MONTHS[date.getMonth()]
        const year = date.getFullYear()
        const key = bucketKey(month, year)
        const prev = counts.get(key) || { month, year, days: 0 }
        prev.days += 1
        counts.set(key, prev)
    })

    const bundle = getPayrollBundle() || { months: [] }
    const months = Array.isArray(bundle.months) ? [...bundle.months] : []

    // Clear prior application of this leave on payroll rows, then re-apply.
    months.forEach((row, index) => {
        if (String(row.staffLeaveIds || '').split(',').includes(leaveKey)) {
            const applied = Number(row[`leaveApplied_${leaveKey}`] || 0)
            if (applied > 0) {
                if (isPermission) row.permission = Math.max(0, Number(row.permission || 0) - applied)
                else if (isCasual) row.casualLeave = Math.max(0, Number(row.casualLeave || 0) - applied)
                else row.otherLeave = Math.max(0, Number(row.otherLeave || 0) - applied)
            }
            const ids = String(row.staffLeaveIds || '').split(',').filter((id) => id && id !== leaveKey)
            row.staffLeaveIds = ids.join(',')
            delete row[`leaveApplied_${leaveKey}`]
            months[index] = row
        }
    })

    counts.forEach(({ month, year, days: dayCount }) => {
        let idx = months.findIndex((row) => (
            row.employeeId === employee.id
            && row.month === month
            && Number(row.year) === Number(year)
        ))
        if (idx < 0) {
            months.push({
                employeeId: employee.id,
                month,
                year: Number(year),
                workingDays: 26,
                lates: 0,
                permission: 0,
                casualLeave: 0,
                otherLeave: 0,
                absent: 0,
                notPunched: 0,
                paymentStatus: 'Unpaid',
                bankRef: '',
                paymentDate: '',
                paymentMode: 'Bank Transfer',
                staffLeaveIds: '',
            })
            idx = months.length - 1
        }
        const row = { ...months[idx] }
        if (isPermission) row.permission = Number(row.permission || 0) + dayCount
        else if (isCasual) row.casualLeave = Number(row.casualLeave || 0) + dayCount
        else row.otherLeave = Number(row.otherLeave || 0) + dayCount
        const ids = String(row.staffLeaveIds || '').split(',').filter(Boolean)
        if (!ids.includes(leaveKey)) ids.push(leaveKey)
        row.staffLeaveIds = ids.join(',')
        row[`leaveApplied_${leaveKey}`] = dayCount
        months[idx] = row
    })

    savePayrollBundle({ ...bundle, months })
    return true
}

export function syncStaffLeaveIntoHr(request) {
    const mapped = upsertHrLeaveFromStaffRequest(request)
    if (String(request?.status || '') === 'Approved') {
        const employee = ensureHrEmployeeForLeave(request)
        syncApprovedLeaveToAttendance(request)
        applyApprovedLeaveToPayrollMonth(request, employee)
    }
    return mapped
}

/** Bulk sync after hydrate — keeps HR Leave Management in step with TM/Driver leave API. */
export function syncAllStaffLeavesIntoHr(requests = []) {
    ;(Array.isArray(requests) ? requests : []).forEach((request) => {
        if (!request) return
        // Focus transport + any request HR can see in the common leave inbox.
        const role = resolveRoleKey(request.submitterRole)
        if (role === ROLES.DRIVER || role === ROLES.TEACHER || role === ROLES.COORDINATOR
            || role === ROLES.PRINCIPAL || role === ROLES.GATEKEEPER || role === ROLES.ADMIN
            || role === ROLES.PRM || role === ROLES.GATEKEEPER_MANAGER || role === ROLES.DIRECTOR) {
            syncStaffLeaveIntoHr(request)
        }
    })
}

export function formatLeaveDateForDisplay(isoOrDmy) {
    const iso = isoFromDmy(isoOrDmy) || String(isoOrDmy || '').slice(0, 10)
    return dmyFromIso(iso) || isoOrDmy || '—'
}
