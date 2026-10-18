/**
 * Parse CSV / simple TSV fee-structure uploads into finance snapshot rows.
 * Expected header (case-insensitive):
 * academicYear, className, feeCategory, feeHead, frequency, amount, dueDay
 */
import { DEFAULT_ACADEMIC_YEAR } from '../financeDomain/financeConstants'

const FREQUENCY_MAP = {
    monthly: 'MONTHLY',
    'term wise': 'TERM_WISE',
    term: 'TERM_WISE',
    term_wise: 'TERM_WISE',
    quarterly: 'QUARTERLY',
    'one time': 'ONE_TIME',
    onetime: 'ONE_TIME',
    one_time: 'ONE_TIME',
    custom: 'CUSTOM_INSTALLMENT',
}

const splitLine = (line) => {
    const cells = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        if (char === '"') {
            inQuotes = !inQuotes
            continue
        }
        if ((char === ',' || char === '\t') && !inQuotes) {
            cells.push(current.trim())
            current = ''
            continue
        }
        current += char
    }
    cells.push(current.trim())
    return cells
}

const normalizeHeader = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const headerIndex = (headers, aliases) => {
    for (let i = 0; i < headers.length; i += 1) {
        if (aliases.includes(headers[i])) return i
    }
    return -1
}

export const parseFeeStructureUpload = (text) => {
    const lines = String(text || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    if (lines.length < 2) {
        return { success: false, message: 'File needs a header row and at least one data row.', rows: [] }
    }

    const headers = splitLine(lines[0]).map(normalizeHeader)
    const idx = {
        academicYear: headerIndex(headers, ['academicyear', 'year', 'ay']),
        className: headerIndex(headers, ['classname', 'class', 'grade']),
        feeCategory: headerIndex(headers, ['feecategory', 'category']),
        feeHead: headerIndex(headers, ['feehead', 'head', 'feename']),
        frequency: headerIndex(headers, ['frequency', 'freq']),
        amount: headerIndex(headers, ['amount', 'fee', 'feeamount']),
        dueDay: headerIndex(headers, ['dueday', 'duedayofmonth', 'due']),
    }
    if (idx.className < 0 || idx.amount < 0) {
        return {
            success: false,
            message: 'Header must include className (or class/grade) and amount columns.',
            rows: [],
        }
    }

    const rows = []
    const errors = []
    lines.slice(1).forEach((line, index) => {
        const cells = splitLine(line)
        const className = cells[idx.className] || ''
        const amountRaw = cells[idx.amount] || ''
        const amount = Number(String(amountRaw).replace(/[^\d.]/g, ''))
        if (!className || !amount) {
            errors.push(`Row ${index + 2}: class and amount are required.`)
            return
        }
        const frequencyRaw = idx.frequency >= 0 ? String(cells[idx.frequency] || '').toLowerCase() : 'monthly'
        const feeCategory = idx.feeCategory >= 0 ? (cells[idx.feeCategory] || 'Tuition Fee') : 'Tuition Fee'
        const feeHead = idx.feeHead >= 0 ? (cells[idx.feeHead] || feeCategory) : feeCategory
        rows.push({
            academicYear: idx.academicYear >= 0 ? (cells[idx.academicYear] || DEFAULT_ACADEMIC_YEAR) : DEFAULT_ACADEMIC_YEAR,
            className,
            feeCategory,
            feeHead,
            frequency: FREQUENCY_MAP[frequencyRaw] || FREQUENCY_MAP[frequencyRaw.replace(/\s+/g, '_')] || 'MONTHLY',
            amount,
            dueDayOfMonth: idx.dueDay >= 0 ? (Number(cells[idx.dueDay]) || 10) : 10,
            concessionApplicable: true,
            mandatory: /tuition/i.test(feeHead) || /tuition/i.test(feeCategory),
            status: 'ACTIVE',
        })
    })

    if (!rows.length) {
        return { success: false, message: errors[0] || 'No valid rows found.', rows: [], errors }
    }
    return { success: true, rows, errors }
}

export const FEE_STRUCTURE_CSV_TEMPLATE = [
    'academicYear,className,feeCategory,feeHead,frequency,amount,dueDay',
    '2026-2027,Grade 1,Tuition Fee,Tuition Fee,Monthly,2500,10',
    '2026-2027,LKG,Tuition Fee,Tuition Fee,Monthly,2000,10',
].join('\n')
