/**
 * Derive Account Head UI metrics from the campus finance snapshot.
 * Prefer these over hardcoded demo series when Finance API mode is on.
 */
import { DEFAULT_ACADEMIC_YEAR, PAYMENT_MODES, TRANSACTION_DIRECTIONS, TRANSACTION_STATUSES } from './financeConstants'
import { formatCurrency } from './financeHelpers'
import {
    CANONICAL_CLASS_COUNT,
    buildCampusClassOptions,
} from '../FeesManagement/feeCampusOptions'

const ONLINE_MODES = new Set([
    PAYMENT_MODES.UPI,
    PAYMENT_MODES.CARD_ONLINE,
    PAYMENT_MODES.PAYMENT_GATEWAY,
    PAYMENT_MODES.BANK_TRANSFER,
])

const initialsOf = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return 'ST'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Map enrolled campus students into the finance snapshot student shape. */
export const mapEnrolledToFinanceStudent = (row, academicYear = DEFAULT_ACADEMIC_YEAR) => {
    const name = String(row?.name || '').trim() || 'Student'
    return {
        id: String(row.id),
        name,
        shortName: name.split(/\s+/)[0] || name,
        initials: initialsOf(name),
        admissionNo: row.admissionNumber || row.admissionNo || '',
        rollNo: row.rollNumber || row.rollNo || '',
        applicationNo: row.applicationNo || '',
        registerNo: row.registerNo || '',
        className: row.className || '',
        section: row.section || '',
        academicYear: row.academicYear || academicYear,
        dateOfBirth: row.dateOfBirth || '',
        bloodGroup: row.bloodGroup || '',
        fatherName: row.fatherName || '',
        motherName: row.motherName || '',
        phone: row.mobileNumber || row.phone || '',
        email: row.email || '',
        familyId: row.familyId || row.parentUserId || '',
        status: row.status || 'Active',
        source: 'enrolled',
    }
}

export const buildFeeQuickStats = ({
    feeStructures = [],
    feeCategories = [],
    students = [],
    installments = [],
    academicYearLabel = '',
    adminYears = [],
} = {}) => {
    const classes = new Set(
        feeStructures.map((row) => String(row.className || '').trim()).filter(Boolean),
    )
    const studentClasses = new Set(
        students.map((row) => String(row.className || '').trim()).filter(Boolean),
    )
    const allCampusClasses = buildCampusClassOptions({ students, feeStructures })
    // Denominator is the full campus class ladder (15: Pre-KG…Grade 12), not “only classes that already have fees”.
    const expectedGrades = Math.max(CANONICAL_CLASS_COUNT, allCampusClasses.length, studentClasses.size)
    const configured = classes.size
    const yearNames = (adminYears || []).map((year) => (typeof year === 'string' ? year : year?.name)).filter(Boolean)
    const currentAdmin = (adminYears || []).find((year) => year?.isCurrent)?.name
    const years = [...new Set([
        ...yearNames,
        ...feeStructures.map((row) => row.academicYear).filter(Boolean),
    ])]
    const displayYear = academicYearLabel || currentAdmin || years[0] || DEFAULT_ACADEMIC_YEAR
    const annualBilling = feeStructures.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
        || installments.reduce((sum, row) => sum + (Number(row.feeAmount) || 0), 0)
    const setupProgress = expectedGrades
        ? Math.min(100, Math.round((configured / expectedGrades) * 100))
        : feeStructures.length ? 100 : 0
    const missingFromLadder = allCampusClasses.filter((name) => !classes.has(name))
    let alertMessage = 'Define fee structures for each class, import students, then Apply fee structures in Settings.'
    if (!feeStructures.length) {
        alertMessage = `No fee structures yet. Define one per class (${expectedGrades} campus classes).`
    } else if (missingFromLadder.length) {
        alertMessage = `${configured} of ${expectedGrades} classes have a fee structure. Still missing: ${missingFromLadder.slice(0, 8).join(', ')}${missingFromLadder.length > 8 ? '…' : ''}.`
    } else if (!students.length) {
        alertMessage = 'All class fee structures are defined. Import enrolled students (Settings), then apply structures to create installments.'
    } else if (!installments.length) {
        alertMessage = 'Fee structures exist but there are no installments yet. Use Settings → Apply fee structures to students (student class must match the structure class).'
    } else {
        alertMessage = `${installments.length} installment(s) ready for collection.`
    }

    return {
        academicYear: `${String(displayYear).toUpperCase()} ACADEMIC YEAR`,
        gradesConfigured: `${configured} / ${expectedGrades}`,
        feeCategories: String(feeCategories.length || new Set(feeStructures.map((r) => r.feeCategoryId).filter(Boolean)).size),
        termsSplit: feeStructures.some((r) => String(r.frequency || '').includes('TERM')) ? 'Term / custom' : 'Monthly / custom',
        annualBilling: formatCurrency(annualBilling),
        setupProgress,
        alertMessage,
        structureCount: feeStructures.length,
        studentCount: students.length,
        installmentCount: installments.length,
        years: years.length ? years : [DEFAULT_ACADEMIC_YEAR],
        classOptions: ['All Grades', ...allCampusClasses],
    }
}

export const buildCollectionSplit = (receipts = []) => {
    let online = 0
    let offline = 0
    receipts.forEach((row) => {
        const amount = Number(row.amountPaid ?? row.amount ?? 0) || 0
        const mode = String(row.paymentMode || '').toUpperCase()
        if (ONLINE_MODES.has(mode) || mode.includes('UPI') || mode.includes('GATEWAY') || mode.includes('ONLINE')) {
            online += amount
        } else {
            offline += amount
        }
    })
    const total = online + offline
    const onlinePercent = total ? Math.round((online / total) * 100) : 0
    return {
        onlinePercent,
        onlineAmount: formatCurrency(online),
        offlineAmount: formatCurrency(offline),
        onlineValue: online || 0,
        offlineValue: offline || 0,
    }
}

export const buildApprovalStatus = (approvals = []) => {
    const pending = approvals.filter((row) => !row.status || String(row.status).toLowerCase() === 'pending').length
    const approved = approvals.filter((row) => String(row.status || '').toLowerCase() === 'approved').length
    const rejected = approvals.filter((row) => String(row.status || '').toLowerCase() === 'rejected').length
    const decided = approved + rejected
    const successRate = decided ? Math.round((approved / decided) * 100) : 0
    return { pending, approved, rejected, successRate }
}

const monthKey = (value) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number)
    if (!y || !m) return key
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' })
}

/** Last N calendar months of posted inflow/outflow (amounts in rupees). */
export const buildMonthlyFlowTrend = (transactions = [], months = 6) => {
    const now = new Date()
    const keys = []
    for (let i = months - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const inflow = Object.fromEntries(keys.map((k) => [k, 0]))
    const outflow = Object.fromEntries(keys.map((k) => [k, 0]))
    transactions.forEach((row) => {
        if (row.status && row.status !== TRANSACTION_STATUSES.POSTED) return
        const key = monthKey(row.transactionDate || row.date || row.createdAt)
        if (!key || !(key in inflow)) return
        const amount = Number(row.amount) || 0
        if (row.direction === TRANSACTION_DIRECTIONS.OUT) outflow[key] += amount
        else inflow[key] += amount
    })
    return {
        labels: keys.map(monthLabel),
        inflow: keys.map((k) => inflow[k]),
        outflow: keys.map((k) => outflow[k]),
        // chart helpers often want lakhs
        inflowLakhs: keys.map((k) => Number((inflow[k] / 100000).toFixed(2))),
        outflowLakhs: keys.map((k) => Number((outflow[k] / 100000).toFixed(2))),
    }
}

export const buildMoneyFlowSources = (transactions = []) => {
    const inBy = new Map()
    const outBy = new Map()
    transactions.forEach((row) => {
        if (row.status && row.status !== TRANSACTION_STATUSES.POSTED) return
        const amount = Number(row.amount) || 0
        const label = row.category || row.sourceModule || 'Other'
        const map = row.direction === TRANSACTION_DIRECTIONS.OUT ? outBy : inBy
        map.set(label, (map.get(label) || 0) + amount)
    })
    const toBars = (map, tone) => {
        const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        const max = rows[0]?.[1] || 1
        return rows.map(([label, amount]) => ({
            label,
            amount: formatCurrency(amount),
            value: Math.max(8, Math.round((amount / max) * 100)),
            tone,
        }))
    }
    return {
        moneyIn: toBars(inBy, 'in'),
        moneyOut: toBars(outBy, 'out'),
    }
}

export const buildTransactionTimeline = (transactions = [], limit = 40) => (
    [...transactions]
        .sort((a, b) => String(b.transactionDate || b.createdAt || '').localeCompare(String(a.transactionDate || a.createdAt || '')))
        .slice(0, limit)
        .map((row) => {
            const isOut = row.direction === TRANSACTION_DIRECTIONS.OUT
            return {
                id: row.id,
                type: isOut ? 'out' : 'in',
                title: row.narration || row.category || (isOut ? 'Money out' : 'Money in'),
                meta: [
                    row.transactionDate || row.date || '—',
                    row.paymentMode,
                    row.voucherNo || row.reference,
                    row.status,
                ].filter(Boolean).join(' · '),
                amount: `${isOut ? '−' : '+'}${formatCurrency(row.amount || 0)}`,
            }
        })
)

export const buildCashFlowSummary = (transactions = []) => {
    const trend = buildMonthlyFlowTrend(transactions, 6)
    const inflow = trend.inflow.reduce((a, b) => a + b, 0)
    const outflow = trend.outflow.reduce((a, b) => a + b, 0)
    const peakIdx = trend.inflow.reduce((best, value, index, arr) => (value > arr[best] ? index : best), 0)
    const lowIdx = trend.inflow.reduce((best, value, index, arr) => (value < arr[best] ? index : best), 0)
    return {
        cards: [
            { label: '6-month inflow', value: formatCurrency(inflow), sub: 'Posted IN', iconTone: 'success' },
            { label: '6-month outflow', value: formatCurrency(outflow), sub: 'Posted OUT', iconTone: 'danger' },
            { label: 'Net', value: formatCurrency(inflow - outflow), sub: 'In − out', iconTone: 'info' },
            { label: 'Posted txns', value: String(transactions.filter((r) => !r.status || r.status === TRANSACTION_STATUSES.POSTED).length), sub: 'Snapshot', iconTone: 'success' },
        ],
        peakLabel: trend.labels[peakIdx] || '—',
        peakAmount: formatCurrency(trend.inflow[peakIdx] || 0),
        lowLabel: trend.labels[lowIdx] || '—',
        lowAmount: formatCurrency(trend.inflow[lowIdx] || 0),
        spending: buildMoneyFlowSources(transactions).moneyOut,
    }
}

export const buildIncomeExpenseDaily = (transactions = []) => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const income = Array(7).fill(0)
    const expense = Array(7).fill(0)
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    transactions.forEach((row) => {
        if (row.status && row.status !== TRANSACTION_STATUSES.POSTED) return
        const date = new Date(row.transactionDate || row.date || row.createdAt)
        if (Number.isNaN(date.getTime()) || date < start) return
        const day = date.getDay() // 0 Sun
        const index = day === 0 ? 6 : day - 1
        const amount = Number(row.amount) || 0
        if (row.direction === TRANSACTION_DIRECTIONS.OUT) expense[index] += amount
        else income[index] += amount
    })
    return { labels, income, expense }
}
