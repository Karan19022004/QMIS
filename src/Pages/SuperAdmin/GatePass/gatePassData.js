import { getStudentGatePasses, hydrateStudentGatePassesFromApi } from '../../FrontOffice/GatePass/gatePassData'
import {
    getHostelGatePasses,
    hydrateHostelGatePassesFromApi,
} from '../../FrontOffice/HostelGatePass/hostelGatePassData'
import {
    getMaterialGatePasses,
    hydrateMaterialGatePassesFromApi,
} from '../../FrontOffice/MaterialGatePass/materialGatePassData'
import { frontOfficeApiOn } from '../../FrontOffice/frontOfficeStore'

export const ROUTE_BASE = '/super-admin/gate-pass'

export const PASS_CATEGORIES = ['Student', 'Hostel', 'Material']

export const statusBadgeColor = {
    Approved: 'bg-[#4CAF5033] text-[#4CAF50]',
    Pending: 'bg-[#FF980033] text-[#FF9800]',
    Rejected: 'bg-[#FF000033] text-[#FF0000]',
    'Partially Approved': 'bg-[#2196F333] text-[#2196F3]',
    'Checked Out': 'bg-[#2196F333] text-[#2196F3]',
    Returned: 'bg-[#4CAF5033] text-[#4CAF50]',
    Cancelled: 'bg-[#FF000033] text-[#FF0000]',
}

export const passCategoryBadgeColor = {
    Student: 'bg-[#515DEF33] text-[#515DEF]',
    Hostel: 'bg-[#9C27B033] text-[#9C27B0]',
    Material: 'bg-[#FF980033] text-[#FF9800]',
}

const toListItem = (record) => ({
    id: record.id,
    passCategory: record.passCategory,
    passId: record.passId ?? record.gatePassId ?? record.mgpNo,
    subjectName: record.studentName ?? record.driverName ?? '—',
    subjectDetail: record.classSection ?? record.vehicleNo ?? record.hostel ?? '—',
    date: record.date ?? record.outDate,
    status: record.status,
    createdBy: record.createdBy ?? 'Front Office',
    createdAt: record.createdAt ?? record.date ?? record.outDate,
    details: record,
})

/** Pull student / hostel / material gate passes from the same Front Office SoT (API when signed in). */
export const hydrateAllGatePassesFromApi = async () => {
    if (frontOfficeApiOn()) {
        await Promise.all([
            hydrateStudentGatePassesFromApi(),
            hydrateHostelGatePassesFromApi(),
            hydrateMaterialGatePassesFromApi(),
        ])
    }
    return getAllGatePasses()
}

export const getAllGatePasses = () => {
    const studentItems = getStudentGatePasses().map((record) =>
        toListItem({
            ...record,
            id: `student-${record.id}`,
            passCategory: 'Student',
            passId: record.gatePassId || record.id,
            createdBy: record.createdBy || 'Front Office',
        }),
    )
    const hostelItems = getHostelGatePasses().map((record) =>
        toListItem({
            ...record,
            id: `hostel-${record.id}`,
            passCategory: 'Hostel',
            passId: record.gatePassId,
        }),
    )
    const materialItems = getMaterialGatePasses().map((record) =>
        toListItem({
            ...record,
            id: `material-${record.id}`,
            passCategory: 'Material',
            passId: record.mgpNo,
        }),
    )

    return [...studentItems, ...hostelItems, ...materialItems].sort((a, b) => {
        const dateA = a.createdAt ?? a.date ?? ''
        const dateB = b.createdAt ?? b.date ?? ''
        return dateB.localeCompare(dateA)
    })
}

export const getGatePassById = (id) =>
    getAllGatePasses().find((record) => record.id === id) ?? null

export const filterGatePasses = (
    records,
    { search = '', status = '', passCategory = '' } = {},
) => {
    const query = search.trim().toLowerCase()

    return records.filter((record) => {
        if (passCategory && record.passCategory !== passCategory) return false
        if (status && record.status !== status) return false
        if (!query) return true

        const haystack = [
            record.passCategory,
            record.passId,
            record.subjectName,
            record.subjectDetail,
            record.status,
            record.createdBy,
        ]
            .join(' ')
            .toLowerCase()

        return haystack.includes(query)
    })
}

export const getGatePassStatusOptions = (records) =>
    [...new Set(records.map((record) => record.status).filter(Boolean))].sort()
