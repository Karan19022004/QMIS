/**
 * Derive Account Head UI metrics from the campus finance snapshot.
 * Prefer these over hardcoded demo series when Finance API mode is on.
 */
import { DEFAULT_ACADEMIC_YEAR, PAYMENT_MODES, TRANSACTION_DIRECTIONS, TRANSACTION_STATUSES } from './financeConstants'
import {
    compareAcademicYears,
    formatCurrency,
    normalizeAcademicYear,
    sameAcademicYear,
    summarizeStudentFees,
} from './financeHelpers'
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

const emptyFeeYearStats = (academicYear = '') => ({
    academicYear,
    totalDemand: 0,
    totalConcession: 0,
    netDemand: 0,
    collected: 0,
    outstanding: 0,
    fineCollected: 0,
    defaulters: 0,
})

const previousAcademicYear = (year) => {
    const normalized = normalizeAcademicYear(year)
    const match = String(normalized).match(/^(20\d{2})-(20\d{2})$/)
    if (!match) return ''
    const start = Number(match[1])
    return `${start - 1}-${start}`
}

export const buildFeeYearStats = (installments = [], { academicYear, studentIds, categoryIds } = {}) => {
    const rows = installments.filter((row) => {
        if (academicYear && row.academicYear && !sameAcademicYear(row.academicYear, academicYear)) return false
        if (studentIds && !studentIds.has(String(row.studentId))) return false
        if (categoryIds && !categoryIds.has(String(row.feeCategoryId))) return false
        return true
    })
    const summary = summarizeStudentFees(rows)
    const outstandingByStudent = new Map()
    rows.forEach((row) => {
        const key = String(row.studentId || '')
        if (!key) return
        outstandingByStudent.set(key, (outstandingByStudent.get(key) || 0) + (Number(row.balanceAmount) || 0))
    })
    let defaulters = 0
    outstandingByStudent.forEach((balance) => {
        if (balance > 0) defaulters += 1
    })
    return {
        academicYear: academicYear || '',
        totalDemand: summary.totalFee,
        totalConcession: summary.totalConcession,
        netDemand: summary.netPayable,
        collected: summary.paid,
        outstanding: summary.outstanding,
        fineCollected: summary.totalFine,
        defaulters,
    }
}

/** Live fee YoY comparison from snapshot installments / students / categories — no invented totals. */
export const buildFeeComparisonFromSnapshot = ({
    installments = [],
    students = [],
    feeCategories = [],
    className = 'All Classes',
    categoryName = 'All Fee Categories',
    currentYear = DEFAULT_ACADEMIC_YEAR,
} = {}) => {
    const studentById = new Map(students.map((row) => [String(row.id), row]))
    const categoryById = new Map(feeCategories.map((row) => [String(row.id), row]))
    const classOptions = ['All Classes', ...[...new Set(
        students.map((row) => String(row.className || '').trim()).filter(Boolean),
    )].sort()]
    const categoryOptions = ['All Fee Categories', ...feeCategories
        .map((row) => row.name)
        .filter(Boolean)]

    let studentIds = null
    if (className && className !== 'All Classes') {
        studentIds = new Set(
            students
                .filter((row) => String(row.className || '').trim() === className)
                .map((row) => String(row.id)),
        )
    }

    let categoryIds = null
    if (categoryName && categoryName !== 'All Fee Categories') {
        categoryIds = new Set(
            feeCategories
                .filter((row) => row.name === categoryName)
                .map((row) => String(row.id)),
        )
    }

    const scoped = installments.filter((row) => {
        if (studentIds && !studentIds.has(String(row.studentId))) return false
        if (categoryIds && !categoryIds.has(String(row.feeCategoryId))) return false
        return true
    })

    const years = [...new Set(
        scoped.map((row) => normalizeAcademicYear(row.academicYear)).filter(Boolean),
    )].sort()
    const currentNormalized = normalizeAcademicYear(currentYear) || DEFAULT_ACADEMIC_YEAR
    const resolvedCurrent = years.includes(currentNormalized)
        ? currentNormalized
        : (years[years.length - 1] || currentNormalized)
    const previous = years.filter((year) => year < resolvedCurrent).pop()
        || previousAcademicYear(resolvedCurrent)

    const currentStats = buildFeeYearStats(scoped, { academicYear: resolvedCurrent })
    const previousStats = years.includes(previous)
        ? buildFeeYearStats(scoped, { academicYear: previous })
        : emptyFeeYearStats(previous)

    return {
        currentStats,
        previousStats,
        currentYear: resolvedCurrent,
        previousYear: previous || 'Prior year',
        classOptions,
        categoryOptions,
        comparison: compareAcademicYears(currentStats, previousStats),
        studentById,
        categoryById,
        installmentCount: scoped.length,
    }
}

const txnDateMs = (row) => {
    const date = new Date(row.transactionDate || row.date || row.createdAt)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

/** Posted OUT transactions grouped by category, with last-90-day vs prior-90-day change. */
export const buildExpenditureBreakdownFromTransactions = (transactions = []) => {
    const posted = transactions.filter((row) => (
        row.direction === TRANSACTION_DIRECTIONS.OUT
        && (!row.status || row.status === TRANSACTION_STATUSES.POSTED)
    ))
    const now = Date.now()
    const termMs = 90 * 24 * 60 * 60 * 1000
    const thisTermStart = now - termMs
    const lastTermStart = now - (2 * termMs)

    const totals = new Map()
    posted.forEach((row) => {
        const category = row.category || row.sourceModule || 'Other'
        const amount = Number(row.amount) || 0
        const ms = txnDateMs(row)
        const cur = totals.get(category) || { amount: 0, thisTerm: 0, lastTerm: 0 }
        cur.amount += amount
        if (ms >= thisTermStart) cur.thisTerm += amount
        else if (ms >= lastTermStart) cur.lastTerm += amount
        totals.set(category, cur)
    })

    const grand = [...totals.values()].reduce((sum, row) => sum + row.amount, 0)
    return [...totals.entries()]
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([category, row]) => {
            const delta = row.lastTerm ? ((row.thisTerm - row.lastTerm) / row.lastTerm) * 100 : null
            return {
                category,
                amount: formatCurrency(row.amount),
                percent: grand ? `${((row.amount / grand) * 100).toFixed(1)}%` : '0%',
                vsLastTerm: delta == null ? '—' : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%`,
                trend: delta == null ? 'flat' : (delta < 0 ? 'down' : 'up'),
            }
        })
}

const stdev = (values) => {
    if (!values.length) return 0
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
    return Math.sqrt(variance)
}

/** Trends cards, YoY bars, and observations from posted snapshot transactions. */
export const buildTrendsFromTransactions = (transactions = []) => {
    const posted = transactions.filter((row) => !row.status || row.status === TRANSACTION_STATUSES.POSTED)
    const trend = buildMonthlyFlowTrend(posted, 12)
    const last3In = trend.inflow.slice(-3).reduce((sum, value) => sum + value, 0)
    const last3Out = trend.outflow.slice(-3).reduce((sum, value) => sum + value, 0)
    const avgSurplus = (last3In - last3Out) / 3
    const maxOutIdx = trend.outflow.reduce((best, value, index, arr) => (value > arr[best] ? index : best), 0)
    const maxInIdx = trend.inflow.reduce((best, value, index, arr) => (value > arr[best] ? index : best), 0)
    const meanOut = trend.outflow.length
        ? trend.outflow.reduce((sum, value) => sum + value, 0) / trend.outflow.length
        : 0
    const volatility = meanOut ? stdev(trend.outflow) / meanOut : 0
    const volatilityLabel = volatility < 0.15 ? 'Low' : volatility < 0.35 ? 'Moderate' : 'High'

    const byYear = new Map()
    posted.forEach((row) => {
        const iso = String(row.transactionDate || row.date || '').slice(0, 4)
        if (!iso) return
        const cur = byYear.get(iso) || { income: 0, expenditure: 0 }
        const amount = Number(row.amount) || 0
        if (row.direction === TRANSACTION_DIRECTIONS.OUT) cur.expenditure += amount
        else cur.income += amount
        byYear.set(iso, cur)
    })
    const years = [...byYear.keys()].sort()
    const maxIncome = Math.max(1, ...years.map((year) => byYear.get(year).income))
    const maxExpense = Math.max(1, ...years.map((year) => byYear.get(year).expenditure))
    const yearOnYear = years.flatMap((year) => {
        const row = byYear.get(year)
        return [
            { label: `Income — ${year}`, amount: formatCurrency(row.income), value: Math.max(6, Math.round((row.income / maxIncome) * 100)), tone: 'in' },
            { label: `Expenditure — ${year}`, amount: formatCurrency(row.expenditure), value: Math.max(6, Math.round((row.expenditure / maxExpense) * 100)), tone: 'out' },
        ]
    })

    const peakMonth = trend.labels[maxInIdx] || '—'
    const spendMonth = trend.labels[maxOutIdx] || '—'
    const salaryRows = posted.filter((row) => (
        row.direction === TRANSACTION_DIRECTIONS.OUT
        && /salary|payroll/i.test(`${row.category || ''} ${row.sourceModule || ''} ${row.narration || ''}`)
    ))
    const salaryByMonth = new Map()
    salaryRows.forEach((row) => {
        const key = String(row.transactionDate || row.date || '').slice(0, 7)
        if (!key) return
        salaryByMonth.set(key, (salaryByMonth.get(key) || 0) + (Number(row.amount) || 0))
    })
    const salaryValues = [...salaryByMonth.values()]
    const salaryMean = salaryValues.length ? salaryValues.reduce((sum, value) => sum + value, 0) / salaryValues.length : 0
    const salaryVol = salaryMean ? (stdev(salaryValues) / salaryMean) * 100 : 0

    const cards = [
        {
            label: '3-Month Avg. Surplus',
            value: formatCurrency(avgSurplus),
            sub: 'per month',
            iconTone: avgSurplus >= 0 ? 'success' : 'danger',
            subTone: avgSurplus >= 0 ? 'success' : 'danger',
        },
        {
            label: 'Highest Spend Month',
            value: spendMonth,
            sub: `${formatCurrency(trend.outflow[maxOutIdx] || 0)} outflow`,
            subTone: 'danger',
            iconTone: 'danger',
        },
        {
            label: 'Collection Peak',
            value: peakMonth,
            sub: `${formatCurrency(trend.inflow[maxInIdx] || 0)} inflow`,
            subTone: 'success',
            iconTone: 'success',
        },
        {
            label: 'Expense Volatility',
            value: volatilityLabel,
            sub: meanOut ? `${(volatility * 100).toFixed(0)}% month-to-month` : 'No posted OUT yet',
            iconTone: 'info',
        },
    ]

    const observations = [
        posted.length
            ? `Fee / inflow collection peaks in ${peakMonth} on the current snapshot (${formatCurrency(trend.inflow[maxInIdx] || 0)}).`
            : 'No posted transactions on the finance snapshot yet — trends will appear after collections and expenses are recorded.',
        spendMonth !== '—'
            ? `Highest outflow month is ${spendMonth} (${formatCurrency(trend.outflow[maxOutIdx] || 0)}).`
            : 'No posted expenditure months yet.',
        salaryValues.length
            ? `Salary / payroll spend varies ${salaryVol.toFixed(1)}% month-to-month across ${salaryValues.length} month(s).`
            : 'No salary / payroll OUT lines on the snapshot yet.',
    ]

    return { cards, yearOnYear, observations }
}
