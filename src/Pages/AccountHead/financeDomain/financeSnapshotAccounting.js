/**
 * Derive Account Head COA / FS / recon / MFP views from campus finance snapshot rows.
 * Does not invent collection totals — balances come from posted GL / books / installments.
 */
import { formatCurrency, parseRupeeAmount } from './financeHelpers'

/** Master COA structure with zero balances — live balances come from GL. */
export const SNAPSHOT_COA_SEED = [
    { id: 'COA-001', accountCode: '1010', accountName: 'Cash in Hand', accountType: 'Asset', parentAccount: '1000 · Current Assets', status: 'Active', balance: '₹0' },
    { id: 'COA-002', accountCode: '1011', accountName: 'Petty Cash — Office', accountType: 'Asset', parentAccount: 'Cash', status: 'Active', balance: '₹0' },
    { id: 'COA-003', accountCode: '1020', accountName: 'Bank — SBI Current A/c', accountType: 'Asset', parentAccount: 'Bank', status: 'Active', balance: '₹0' },
    { id: 'COA-004', accountCode: '1021', accountName: 'Bank — ICICI Savings A/c', accountType: 'Asset', parentAccount: 'Bank', status: 'Active', balance: '₹0' },
    { id: 'COA-005', accountCode: '1110', accountName: 'Student Fee Receivable', accountType: 'Asset', parentAccount: 'Receivables', status: 'Active', balance: '₹0' },
    { id: 'COA-006', accountCode: '2020', accountName: 'Vendor Payables', accountType: 'Liability', parentAccount: 'Payables', status: 'Active', balance: '₹0' },
    { id: 'COA-007', accountCode: '2010', accountName: 'TDS Payable', accountType: 'Liability', parentAccount: 'Payables', status: 'Active', balance: '₹0' },
    { id: 'COA-008', accountCode: '4010', accountName: 'Fee Income — Tuition', accountType: 'Income', parentAccount: 'Tuition Fee', status: 'Active', balance: '₹0' },
    { id: 'COA-009', accountCode: '4020', accountName: 'Fee Income — Transport', accountType: 'Income', parentAccount: 'Transport Fee', status: 'Active', balance: '₹0' },
    { id: 'COA-010', accountCode: '4030', accountName: 'Hostel Fee', accountType: 'Income', parentAccount: 'Hostel Fee', status: 'Active', balance: '₹0' },
    { id: 'COA-011', accountCode: '5010', accountName: 'Salary — Teaching Staff', accountType: 'Expense', parentAccount: 'Salary', status: 'Active', balance: '₹0' },
    { id: 'COA-012', accountCode: '5120', accountName: 'Electricity', accountType: 'Expense', parentAccount: 'Electricity', status: 'Active', balance: '₹0' },
    { id: 'COA-013', accountCode: '5110', accountName: 'Fuel', accountType: 'Expense', parentAccount: 'Fuel', status: 'Active', balance: '₹0' },
    { id: 'COA-014', accountCode: '5121', accountName: 'Maintenance', accountType: 'Expense', parentAccount: 'Maintenance', status: 'Active', balance: '₹0' },
    { id: 'COA-015', accountCode: '1030', accountName: 'Wallet Float (User Wallets)', accountType: 'Asset', parentAccount: '1000 · Current Assets', status: 'Active', balance: '₹0' },
    { id: 'COA-016', accountCode: '5130', accountName: 'Office Supplies', accountType: 'Expense', parentAccount: '5100 · Operational Expense', status: 'Inactive', balance: '₹0' },
]

const debitNature = (accountType) => accountType === 'Asset' || accountType === 'Expense'

const glTotalsByAccount = (glEntries = []) => {
    const map = new Map()
    glEntries.forEach((line) => {
        const name = String(line.ledgerAccount || '').trim()
        if (!name) return
        const cur = map.get(name) || { debit: 0, credit: 0 }
        cur.debit += parseRupeeAmount(line.debit)
        cur.credit += parseRupeeAmount(line.credit)
        map.set(name, cur)
    })
    return map
}

const guessAccountType = (accountName) => {
    const n = accountName.toLowerCase()
    if (n.includes('payable') || n.includes('liability') || n.includes('tds')) return 'Liability'
    if (n.includes('income') || n.includes('fee') || n.includes('donation')) return 'Income'
    if (n.includes('expense') || n.includes('salary') || n.includes('fuel') || n.includes('electric') || n.includes('maintenance') || n.includes('supplies')) return 'Expense'
    return 'Asset'
}

/** Apply posted GL nets onto COA rows; append any GL ledger not yet in COA. */
export const withLiveCoaBalances = (accounts = [], glEntries = []) => {
    const totals = glTotalsByAccount(glEntries)
    const used = new Set()
    const rows = accounts.map((acc) => {
        const t = totals.get(acc.accountName)
        used.add(acc.accountName)
        if (!t) return { ...acc, balance: formatCurrency(0) }
        const net = debitNature(acc.accountType) ? t.debit - t.credit : t.credit - t.debit
        return { ...acc, balance: formatCurrency(net) }
    })
    let nextCode = 9000
    totals.forEach((t, name) => {
        if (used.has(name)) return
        const accountType = guessAccountType(name)
        const net = debitNature(accountType) ? t.debit - t.credit : t.credit - t.debit
        rows.push({
            id: `COA-GL-${name.replace(/\s+/g, '-').slice(0, 40)}`,
            accountCode: String(nextCode++),
            accountName: name,
            accountType,
            parentAccount: 'From GL',
            status: 'Active',
            balance: formatCurrency(net),
        })
    })
    return rows
}

export const buildTrialBalanceFromGl = (glEntries = []) => {
    const totals = glTotalsByAccount(glEntries)
    const rows = []
    totals.forEach((t, account) => {
        const debit = t.debit > t.credit ? t.debit - t.credit : 0
        const credit = t.credit > t.debit ? t.credit - t.debit : 0
        rows.push({
            id: `TB-${account}`,
            account,
            debit: debit ? formatCurrency(debit) : '—',
            credit: credit ? formatCurrency(credit) : '—',
            department: 'All Departments',
            campus: 'All Campuses',
        })
    })
    return rows.sort((a, b) => a.account.localeCompare(b.account))
}

export const buildProfitLossFromGl = (glEntries = [], chartOfAccounts = []) => {
    const typeByName = new Map(chartOfAccounts.map((row) => [row.accountName, row.accountType]))
    const totals = glTotalsByAccount(glEntries)
    const income = []
    const expense = []
    let incomeTotal = 0
    let expenseTotal = 0
    totals.forEach((t, name) => {
        const type = typeByName.get(name) || guessAccountType(name)
        if (type === 'Income') {
            const amt = t.credit - t.debit
            if (amt === 0) return
            incomeTotal += amt
            income.push({ label: name, amount: formatCurrency(amt), indent: true })
        } else if (type === 'Expense') {
            const amt = t.debit - t.credit
            if (amt === 0) return
            expenseTotal += amt
            expense.push({ label: name, amount: formatCurrency(amt), indent: true })
        }
    })
    const net = incomeTotal - expenseTotal
    return [
        { label: 'Income', type: 'section' },
        ...income,
        { label: 'Total Income', amount: formatCurrency(incomeTotal), type: 'total' },
        { label: 'Expenses', type: 'section' },
        ...expense,
        { label: 'Total Expenses', amount: formatCurrency(expenseTotal), type: 'total' },
        {
            label: net >= 0 ? 'Net Surplus' : 'Net Deficit',
            amount: formatCurrency(Math.abs(net)),
            type: 'net',
            profit: net >= 0,
        },
    ]
}

export const buildBalanceSheetFromGl = (glEntries = [], chartOfAccounts = []) => {
    const typeByName = new Map(chartOfAccounts.map((row) => [row.accountName, row.accountType]))
    const totals = glTotalsByAccount(glEntries)
    const assets = []
    const liabilities = []
    let assetTotal = 0
    let liabilityTotal = 0
    totals.forEach((t, name) => {
        const type = typeByName.get(name) || guessAccountType(name)
        if (type === 'Asset') {
            const amt = t.debit - t.credit
            if (amt === 0) return
            assetTotal += amt
            assets.push({ label: name, amount: formatCurrency(amt), indent: true })
        } else if (type === 'Liability' || type === 'Equity') {
            const amt = t.credit - t.debit
            if (amt === 0) return
            liabilityTotal += amt
            liabilities.push({ label: name, amount: formatCurrency(amt), indent: true })
        }
    })
    const equityPlug = assetTotal - liabilityTotal
    return [
        { label: 'Assets', type: 'section' },
        ...assets,
        { label: 'Total Assets', amount: formatCurrency(assetTotal), type: 'total' },
        { label: 'Liabilities & Equity', type: 'section' },
        ...liabilities,
        ...(equityPlug !== 0
            ? [{ label: 'Retained / balancing figure', amount: formatCurrency(equityPlug), indent: true }]
            : []),
        { label: 'Total Liabilities & Equity', amount: formatCurrency(liabilityTotal + equityPlug), type: 'total' },
    ]
}

export const buildCashFlowFromBooks = ({ cashBookEntries = [], bankBookEntries = [], transactions = [] } = {}) => {
    const cashIn = cashBookEntries.reduce((sum, row) => sum + parseRupeeAmount(row.receipt), 0)
    const cashOut = cashBookEntries.reduce((sum, row) => sum + parseRupeeAmount(row.payment), 0)
    const bankIn = bankBookEntries.reduce((sum, row) => sum + parseRupeeAmount(row.deposit), 0)
    const bankOut = bankBookEntries.reduce((sum, row) => sum + parseRupeeAmount(row.withdrawal), 0)
    const postedIn = transactions
        .filter((row) => row.direction === 'IN' && row.status === 'POSTED')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const postedOut = transactions
        .filter((row) => row.direction === 'OUT' && row.status === 'POSTED')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    return [
        { label: 'Operating receipts (posted IN)', amount: formatCurrency(postedIn), type: 'section' },
        { label: 'Cash book receipts', amount: formatCurrency(cashIn), indent: true },
        { label: 'Bank book deposits', amount: formatCurrency(bankIn), indent: true },
        { label: 'Operating payments (posted OUT)', amount: formatCurrency(postedOut), type: 'section' },
        { label: 'Cash book payments', amount: formatCurrency(cashOut), indent: true },
        { label: 'Bank book withdrawals', amount: formatCurrency(bankOut), indent: true },
        {
            label: 'Net cash movement (books)',
            amount: formatCurrency((cashIn + bankIn) - (cashOut + bankOut)),
            type: 'net',
            profit: (cashIn + bankIn) >= (cashOut + bankOut),
        },
    ]
}

/** Build recon register from bank-book rows when snapshot reconciliations are empty. */
export const buildReconFromBankBook = (bankBookEntries = []) => bankBookEntries.map((row) => {
    const amount = row.deposit && row.deposit !== '—' ? row.deposit : row.withdrawal
    return {
        id: `BRC-${row.id || row.voucher || Date.now()}`,
        date: row.date,
        dateIso: row.dateIso || '',
        voucher: row.voucher || '—',
        erpAmount: amount || '—',
        bankAmount: '—',
        difference: amount || '₹0',
        status: 'Pending Reconciliation',
        bank: row.bank || row.account || 'Bank',
        detail: {
            erpEntry: {
                date: row.date,
                voucher: row.voucher || '—',
                description: row.description || 'Bank book entry',
                amount: amount || '—',
            },
            bankEntry: null,
            suggestions: [],
        },
    }
})

/** Monthly Fee Performance from installment demand / paid / balance. */
export const buildMfpFromInstallments = (installments = []) => {
    const byMonth = new Map()
    installments.forEach((row) => {
        const month = String(row.month || row.dueDate?.slice?.(0, 7) || 'Unknown')
        const cur = byMonth.get(month) || {
            month,
            label: row.installmentLabel || month,
            students: new Set(),
            demand: 0,
            collected: 0,
            outstanding: 0,
            overdue: 0,
        }
        cur.students.add(row.studentId)
        cur.demand += Number(row.netAmount ?? row.feeAmount ?? 0)
        cur.collected += Number(row.paidAmount ?? 0)
        cur.outstanding += Number(row.balanceAmount ?? 0)
        if (String(row.status || '').toUpperCase() === 'OVERDUE') {
            cur.overdue += Number(row.balanceAmount ?? 0)
        }
        byMonth.set(month, cur)
    })
    return [...byMonth.values()]
        .map((row) => ({
            id: `MFP-${row.month}`,
            month: row.month,
            label: row.label,
            studentCount: row.students.size,
            demand: row.demand,
            collected: row.collected,
            outstanding: row.outstanding,
            overdue: row.overdue,
            collectionPct: row.demand ? (row.collected / row.demand) * 100 : 0,
        }))
        .sort((a, b) => String(a.month).localeCompare(String(b.month)))
}

/** Monthly income/expense series from posted transactions (for Reports charts). */
export const buildMonthlyTxnSeries = (transactions = []) => {
    const byMonth = new Map()
    transactions
        .filter((row) => row.status === 'POSTED')
        .forEach((row) => {
            const iso = String(row.transactionDate || row.date || '').slice(0, 7)
            if (!iso) return
            const cur = byMonth.get(iso) || { month: iso, income: 0, expenditure: 0 }
            const amt = Number(row.amount || 0)
            if (row.direction === 'IN') cur.income += amt
            if (row.direction === 'OUT') cur.expenditure += amt
            byMonth.set(iso, cur)
        })
    const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
    return {
        labels: rows.map((row) => row.month),
        income: rows.map((row) => Math.round(row.income)),
        expenditure: rows.map((row) => Math.round(row.expenditure)),
    }
}

export const buildIncomeMixFromTransactions = (transactions = []) => {
    const byCat = new Map()
    let total = 0
    transactions
        .filter((row) => row.direction === 'IN' && row.status === 'POSTED')
        .forEach((row) => {
            const cat = row.category || row.sourceModule || 'Other'
            const amt = Number(row.amount || 0)
            byCat.set(cat, (byCat.get(cat) || 0) + amt)
            total += amt
        })
    const colors = ['#515DEF', '#4CAF50', '#FF9800', '#2196F3', '#FF5722', '#667085']
    let i = 0
    return [...byCat.entries()].map(([name, value]) => ({
        name,
        value,
        percent: total ? Math.round((value / total) * 100) : 0,
        color: colors[i++ % colors.length],
    }))
}

export const buildBookFeeFromStudents = (students = [], academicYear = '2026-2027') => {
    const yearLabel = academicYear.includes('-') ? academicYear.replace('2026-2027', '2026-27') : academicYear
    return students.slice(0, 5).map((student, index) => ({
        id: `BF-${String(student.id).slice(0, 8)}-${index}`,
        student: student.name || student.admissionNo || `Student ${index + 1}`,
        studentId: student.id,
        academicYear: yearLabel,
        vendor: 'Campus Bookstore',
        book: `${student.className || 'Class'} package`,
        quantity: 1,
        unitCost: 4200,
        assignedFee: 4200,
    }))
}
