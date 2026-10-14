import {
    createFrontOfficeItem,
    frontOfficeApiOn,
    hydrateFrontOfficeCollection,
    peekFrontOfficeCollection,
} from '../frontOfficeStore'

const COLLECTION = 'student-transfers'

export const hydrateStudentTransfersFromApi = () => hydrateFrontOfficeCollection(COLLECTION)

export const getStudentTransfers = () =>
    frontOfficeApiOn() ? peekFrontOfficeCollection(COLLECTION) : []

export const addStudentTransfer = async (payload) => {
    if (!frontOfficeApiOn()) {
        return { success: false, message: 'Front Office API is off.' }
    }
    try {
        const record = await createFrontOfficeItem(COLLECTION, {
            studentName: payload.studentName || '',
            transferType: payload.transferType || 'External',
            transferTo: payload.transferTo || '',
            className: payload.className || payload.class || '',
            reason: payload.reason || '',
            requestedOn: payload.requestedOn || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
            mdApprovalStatus: payload.mdApprovalStatus || 'Pending',
            status: payload.status || 'In Progress',
        })
        return { success: true, record }
    } catch (error) {
        return { success: false, message: error?.message || 'Could not save transfer.' }
    }
}

export const statusBadgeColor = {
    Completed: 'bg-[#4CAF5033] text-[#4CAF50]',
    'In Progress': 'bg-[#FF000033] text-[#FF0000]',
}

export const mdStatusColor = {
    Approved: 'text-[#008000]',
    Pending: 'text-[#FF9800]',
    Rejected: 'text-[#FF0000]',
}
