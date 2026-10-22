import { loadCampusJson, saveCampusJson, hydrateCampusKey, usesCampusApiForKey } from '../../../../services/campusJsonStore'
const STORAGE_KEY = 'process-auditor-compliance-reports'

export const COMPLIANCE_SUMMARY = {
    overall: 91,
    departments: [
        { label: 'Academic', value: 94 },
        { label: 'Transport', value: 88 },
        { label: 'HR', value: 97 },
        { label: 'Accounts', value: 95 },
    ],
}

const DEFAULT_DEPARTMENT_ROWS = [
    { department: 'Academic', totalAudits: 12, compliance: 94, pendingFindings: 3, closedFindings: 18 },
    { department: 'Transport', totalAudits: 8, compliance: 88, pendingFindings: 5, closedFindings: 11 },
    { department: 'HR', totalAudits: 6, compliance: 97, pendingFindings: 1, closedFindings: 9 },
    { department: 'Accounts', totalAudits: 10, compliance: 95, pendingFindings: 2, closedFindings: 14 },
    { department: 'Canteen', totalAudits: 9, compliance: 76, pendingFindings: 8, closedFindings: 12 },
    { department: 'Housekeeping', totalAudits: 7, compliance: 83, pendingFindings: 4, closedFindings: 10 },
    { department: 'IT Support', totalAudits: 5, compliance: 92, pendingFindings: 1, closedFindings: 7 },
    { department: 'Store', totalAudits: 4, compliance: 89, pendingFindings: 2, closedFindings: 5 },
]

export const getComplianceColor = (value) => {
    if (value >= 90) return '#4CAF50'
    if (value >= 75) return '#FF9800'
    return '#FF0000'
}

export const saveComplianceData = (data) => {
    saveCampusJson(STORAGE_KEY, data)
}

/** Campus API / hydrate may store a bare department array; dashboard expects `{ summary, departments }`. */
const normalizeComplianceData = (stored) => {
    if (Array.isArray(stored)) {
        return { summary: COMPLIANCE_SUMMARY, departments: stored }
    }
    if (stored && typeof stored === 'object') {
        const departments = Array.isArray(stored.departments) ? stored.departments : DEFAULT_DEPARTMENT_ROWS
        return {
            summary: stored.summary && typeof stored.summary === 'object' ? stored.summary : COMPLIANCE_SUMMARY,
            departments,
        }
    }
    return { summary: COMPLIANCE_SUMMARY, departments: DEFAULT_DEPARTMENT_ROWS }
}

export const getComplianceData = () => {
    try {
        const stored = loadCampusJson(STORAGE_KEY, null)
        if (stored) return normalizeComplianceData(stored)
    } catch {
        /* ignore */
    }
    const data = { summary: COMPLIANCE_SUMMARY, departments: DEFAULT_DEPARTMENT_ROWS }
    saveComplianceData(data)
    return data
}

export const hydrateFromApi = (seed = DEFAULT_DEPARTMENT_ROWS) => hydrateCampusKey(STORAGE_KEY, seed)
export const usesApiStore = () => usesCampusApiForKey(STORAGE_KEY)
