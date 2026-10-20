/**
 * Build fee masters + unpaid installments for enrolled finance students.
 * Does not invent collection totals — only creates UNPAID demand rows Account Head can collect against.
 */
import {
    BANK_ACCOUNTS,
    FEE_CATEGORIES,
    FINE_RULES,
    POS_TERMINALS,
} from './financeMasters'
import { DEFAULT_ACADEMIC_YEAR, FEE_INSTALLMENT_STATUSES } from './financeConstants'
import { PENDING_REQUESTS } from '../Approvals/approvalsData'

const tuitionAmountForClass = (className) => {
    const key = String(className || '').toLowerCase()
    if (key.includes('grade 1') || key === '1' || key.startsWith('1-')) return 2000
    if (key.includes('grade 2') || key === '2' || key.startsWith('2-')) return 2500
    if (key.includes('5') || key.includes('grade 5')) return 2800
    if (key.includes('8') || key.includes('viii')) return 3500
    if (key.includes('9') || key.includes('grade 9')) return 3800
    if (key.includes('10') || key.includes('grade 10')) return 4200
    return 2500
}

const pad = (n) => String(n).padStart(2, '0')

const monthLabel = (year, monthIndex0) => {
    const date = new Date(year, monthIndex0, 1)
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

const makeInstallment = ({
    id,
    studentId,
    academicYear,
    structureId,
    feeCategoryId,
    feeHead,
    label,
    month,
    dueDate,
    feeAmount,
    status = FEE_INSTALLMENT_STATUSES.UNPAID,
}) => ({
    id,
    studentId,
    academicYear,
    feeStructureId: structureId,
    feeCategoryId,
    feeHead,
    installmentLabel: label,
    month,
    dueDate,
    feeAmount,
    concessionAmount: 0,
    fineAmount: 0,
    netAmount: feeAmount,
    paidAmount: 0,
    balanceAmount: feeAmount,
    status,
    forcedStatus: status === FEE_INSTALLMENT_STATUSES.OVERDUE ? FEE_INSTALLMENT_STATUSES.OVERDUE : undefined,
    fineWaived: false,
})

/**
 * @param {{ students?: object[], existingInstallments?: object[] }} args
 * @returns {{ feeCategories, feeStructures, fineRules, bankAccounts, posTerminals, installments, approvals, meta }}
 */
export const buildCampusFeeLedger = ({ students = [], existingInstallments = [] } = {}) => {
    const academicYear = DEFAULT_ACADEMIC_YEAR
    const now = new Date()
    const year = now.getFullYear()
    const monthIndex = now.getMonth()
    const currentMonth = `${year}-${pad(monthIndex + 1)}`
    const currentDue = `${year}-${pad(monthIndex + 1)}-10`
    const prev = new Date(year, monthIndex - 1, 1)
    const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`
    const prevDue = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-10`

    const classNames = [...new Set(students.map((s) => String(s.className || '').trim()).filter(Boolean))]
    const feeStructures = classNames.map((className) => {
        const amount = tuitionAmountForClass(className)
        const slug = className.replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9-]/g, '')
        return {
            id: `FS-${slug}-TUITION-2627`,
            academicYear,
            className,
            feeCategoryId: 'CAT-TUITION',
            feeHead: 'Tuition Fee',
            frequency: 'MONTHLY',
            amount,
            dueDayOfMonth: 10,
            fineRuleId: 'FINE-TUITION-DAILY',
            concessionApplicable: true,
            mandatory: true,
            status: 'ACTIVE',
        }
    })

    const structureByClass = new Map(feeStructures.map((row) => [row.className, row]))
    const installments = []
    let overdueSeeded = 0

    students.forEach((student, index) => {
        const structure = structureByClass.get(String(student.className || '').trim())
        if (!structure) return
        const studentId = student.id
        const short = String(studentId).slice(0, 8)

        installments.push(makeInstallment({
            id: `INS-${short}-${currentMonth}`,
            studentId,
            academicYear,
            structureId: structure.id,
            feeCategoryId: structure.feeCategoryId,
            feeHead: structure.feeHead,
            label: monthLabel(year, monthIndex),
            month: currentMonth,
            dueDate: currentDue,
            feeAmount: structure.amount,
            status: FEE_INSTALLMENT_STATUSES.UNPAID,
        }))

        // A few overdue prior-month rows so Defaulters has live demand (not invented collections).
        if (overdueSeeded < 3 && index % 4 === 0) {
            overdueSeeded += 1
            installments.push(makeInstallment({
                id: `INS-${short}-${prevMonth}`,
                studentId,
                academicYear,
                structureId: structure.id,
                feeCategoryId: structure.feeCategoryId,
                feeHead: structure.feeHead,
                label: monthLabel(prev.getFullYear(), prev.getMonth()),
                month: prevMonth,
                dueDate: prevDue,
                feeAmount: structure.amount,
                status: FEE_INSTALLMENT_STATUSES.OVERDUE,
            }))
        }
    })

    // Keep any pre-existing installments that are not colliding on id.
    const ids = new Set(installments.map((row) => row.id))
    const preserved = (existingInstallments || []).filter((row) => row?.id && !ids.has(row.id))

    const approvals = PENDING_REQUESTS.slice(0, 3).map((row) => ({
        ...row,
        status: 'Pending',
    }))

    return {
        feeCategories: FEE_CATEGORIES.map((row) => ({ ...row })),
        feeStructures,
        fineRules: FINE_RULES.map((row) => ({ ...row })),
        bankAccounts: BANK_ACCOUNTS.map((row) => ({ ...row })),
        posTerminals: POS_TERMINALS.map((row) => ({ ...row })),
        installments: [...installments, ...preserved],
        approvals,
        meta: {
            demoFeeLedger: true,
            demoFeeLedgerAt: new Date().toISOString(),
            demoFeeLedgerInstallments: installments.length,
        },
    }
}
