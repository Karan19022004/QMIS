import {
    ensureCampusSeed,
    hydrateCampusKey,
    persistCampusJson,
    usesCampusApiForKey,
} from '../../../services/campusJsonStore'
import { nextSerial } from '../../../Common/demoDomain/storage'

export const PROCUREMENT_STORAGE_KEY = 'schoolerp-hk-procurement-v1'

export const PROCUREMENT_STATUSES = [
    'DRAFT',
    'QUOTATION_PENDING',
    'DEPARTMENT_REVIEW',
    'MINOR_APPROVED',
    'ESCALATED',
    'QUOTATION_APPROVED',
    'PO_REQUIRED',
    'PO_RAISED',
    'PO_APPROVED',
    'REJECTED',
    'COMPLETED',
]

const DEMO_PROCUREMENT = [
    {
        id: 'REQ-HK-PO-0001',
        title: 'Housekeeping chemical restock',
        department: 'Housekeeping',
        requestedBy: 'Housekeeping Manager',
        minorPurchase: false,
        amount: 18600,
        status: 'QUOTATION_PENDING',
        quotationFile: '',
        vendorRequired: false,
        poNumber: '',
        primaryApprover: 'Joint Director Operations',
    },
]

const seedFor = () => (usesCampusApiForKey(PROCUREMENT_STORAGE_KEY) ? [] : DEMO_PROCUREMENT)

const MINOR_FLOW = ['QUOTATION_PENDING', 'DEPARTMENT_REVIEW', 'MINOR_APPROVED', 'PO_REQUIRED', 'PO_RAISED', 'PO_APPROVED', 'COMPLETED']
const MAJOR_FLOW = ['QUOTATION_PENDING', 'DEPARTMENT_REVIEW', 'ESCALATED', 'QUOTATION_APPROVED', 'PO_REQUIRED', 'PO_RAISED', 'PO_APPROVED', 'COMPLETED']

export function getHkProcurement() {
    return ensureCampusSeed(PROCUREMENT_STORAGE_KEY, seedFor())
}

export function saveHkProcurement(rows) {
    return persistCampusJson(PROCUREMENT_STORAGE_KEY, rows)
}

export function hydrateHkProcurementFromApi() {
    if (!usesCampusApiForKey(PROCUREMENT_STORAGE_KEY)) return Promise.resolve(false)
    return hydrateCampusKey(PROCUREMENT_STORAGE_KEY, [])
}

export function getHkPurchaseOrders(rows = getHkProcurement()) {
    return rows
        .filter((row) => row.poNumber)
        .map((row) => ({
            id: row.poNumber,
            requestId: row.id,
            vendor: row.vendor || 'Selected vendor',
            amount: row.amount,
            status: ['PO_RAISED', 'PO_APPROVED', 'COMPLETED'].includes(row.status) ? row.status : 'PO_RAISED',
            date: row.poDate || row.createdAt || '',
        }))
}

export async function createHkProcurementRequest(input) {
    const rows = getHkProcurement()
    const record = {
        id: nextSerial('REQ-HK-PO-', rows),
        title: String(input.title || '').trim(),
        department: 'Housekeeping',
        requestedBy: input.requestedBy || 'Housekeeping Manager',
        minorPurchase: Boolean(input.minorPurchase),
        amount: Number(input.amount) || 0,
        status: 'QUOTATION_PENDING',
        quotationFile: input.quotationFile || '',
        vendorRequired: false,
        poNumber: '',
        primaryApprover: input.primaryApprover || 'Joint Director Operations',
        createdAt: new Date().toISOString(),
    }
    const result = await saveHkProcurement([record, ...rows])
    return { ...result, record }
}

export async function advanceHkProcurement(id) {
    const rows = getHkProcurement()
    const current = rows.find((item) => item.id === id)
    if (!current) return { success: false, message: 'Request not found.' }
    const order = current.minorPurchase ? MINOR_FLOW : MAJOR_FLOW
    const index = Math.max(order.indexOf(current.status), 0)
    const status = order[Math.min(index + 1, order.length - 1)] || current.status
    let poNumber = current.poNumber
    let poDate = current.poDate
    if (status === 'PO_RAISED' && !poNumber) {
        poNumber = nextSerial('PO-HK-2026-', rows, 'poNumber')
        poDate = new Date().toISOString().slice(0, 10)
    }
    const next = rows.map((item) => (item.id === id ? { ...item, status, poNumber, poDate } : item))
    const result = await saveHkProcurement(next)
    return { ...result, record: next.find((item) => item.id === id) }
}

export function downloadQuotationTemplate() {
    const csv = 'Vendor,Item,Qty,Unit Rate,Amount,Lead Time,Remarks\nVendor A,Sample item,1,1000,1000,7 days,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'comparative-quotation-template.csv'
    link.click()
    URL.revokeObjectURL(url)
}
