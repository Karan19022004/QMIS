const OPEN_OBSERVATION = new Set(['open', 'assigned', 'in review', 'under review', 'rca pending', 'atr pending'])
const CLOSED_AUDIT = new Set(['completed', 'closed'])
const PENDING_AUDIT = new Set(['pending', 'assigned', 'scheduled', 'not started'])
const CLOSED_ESCALATION = new Set(['closed', 'resolved', 'rejected'])

export const KPI_CARD_DEFS = [
    { label: "Today's Audits", sub: 'Scheduled for today' },
    { label: 'Pending Audits', sub: 'Assigned, not yet started' },
    { label: 'Completed Audits', sub: 'Closed this quarter' },
    { label: 'Overdue Audits', sub: 'Past scheduled date' },
    { label: 'Open Observations', sub: 'Awaiting corrective action' },
    { label: 'Escalated Issues', sub: 'Non-compliance escalated' },
    { label: 'Average Compliance %', sub: 'Across audited departments' },
    { label: 'Departments Audited', sub: 'Unique departments covered' },
]

export const emptyKpiCards = () =>
    KPI_CARD_DEFS.map((card) => ({
        ...card,
        value: card.label.includes('%') ? '0%' : '0',
    }))

const parseLooseDate = (value) => {
    if (!value) return null
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value
    const text = String(value).trim()
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const startOfDay = (date) => {
    const next = new Date(date)
    next.setHours(0, 0, 0, 0)
    return next
}

const sameDay = (left, right) => startOfDay(left).getTime() === startOfDay(right).getTime()

const statusOf = (row) => String(row?.status || '').trim().toLowerCase()

const quarterStart = (now) => {
    const month = now.getMonth()
    const startMonth = month - (month % 3)
    return new Date(now.getFullYear(), startMonth, 1)
}

const asList = (value) => (Array.isArray(value) ? value : [])

const compliancePercent = (compliance, history) => {
    if (compliance && typeof compliance === 'object' && !Array.isArray(compliance)) {
        const overall = Number(compliance.summary?.overall ?? compliance.overall)
        if (Number.isFinite(overall) && overall > 0) return Math.round(overall)
        const departments = asList(compliance.departments)
        if (departments.length) {
            const avg = departments.reduce((sum, row) => sum + (Number(row.compliance ?? row.value) || 0), 0) / departments.length
            return Math.round(avg)
        }
    }
    if (Array.isArray(compliance) && compliance.length) {
        const avg = compliance.reduce((sum, row) => sum + (Number(row.compliance ?? row.value) || 0), 0) / compliance.length
        return Math.round(avg)
    }
    const percents = asList(history)
        .map((row) => Number(row.compliancePercent ?? row.compliance))
        .filter((value) => Number.isFinite(value))
    if (!percents.length) return 0
    return Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
}

export function buildAuditorKpiCards({
    audits = [],
    observations = [],
    openObservations = null,
    escalations = [],
    compliance = null,
    history = [],
} = {}) {
    const now = new Date()
    const today = startOfDay(now)
    const qStart = quarterStart(now)
    const auditList = asList(audits)
    const historyList = asList(history)
    const observationList = asList(observations)
    const escalationList = asList(escalations)

    const todayCount = auditList.filter((row) => {
        const scheduled = parseLooseDate(row.scheduledDate || row.assignedDate || row.date)
        return scheduled && sameDay(scheduled, today)
    }).length

    const pendingCount = auditList.filter((row) => PENDING_AUDIT.has(statusOf(row))).length

    const completedCount = [...auditList, ...historyList].filter((row) => {
        if (!CLOSED_AUDIT.has(statusOf(row))) return false
        const done = parseLooseDate(row.completedOn || row.dueDate || row.scheduledDate || row.auditDate)
        return !done || done >= qStart
    }).length

    const overdueCount = auditList.filter((row) => {
        if (CLOSED_AUDIT.has(statusOf(row))) return false
        if (statusOf(row) === 'overdue') return true
        const due = parseLooseDate(row.dueDate)
        return due && startOfDay(due) < today
    }).length

    const openCount = Array.isArray(openObservations)
        ? openObservations.length
        : observationList.filter((row) => OPEN_OBSERVATION.has(statusOf(row))).length

    const escalatedCount = escalationList.filter((row) => !CLOSED_ESCALATION.has(statusOf(row))).length

    const departments = new Set(
        [...auditList, ...historyList]
            .map((row) => String(row.department || '').trim())
            .filter(Boolean),
    )

    const values = {
        "Today's Audits": String(todayCount),
        'Pending Audits': String(pendingCount),
        'Completed Audits': String(completedCount),
        'Overdue Audits': String(overdueCount),
        'Open Observations': String(openCount),
        'Escalated Issues': String(escalatedCount),
        'Average Compliance %': `${compliancePercent(compliance, historyList)}%`,
        'Departments Audited': String(departments.size),
    }

    return KPI_CARD_DEFS.map((card) => ({
        ...card,
        value: values[card.label] ?? '0',
    }))
}
