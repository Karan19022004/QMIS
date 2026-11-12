import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import {
    decideHostelGatePassApproval,
    filterHostelGatePasses,
    formatOutTimeForDisplay,
    getHostelGatePasses,
    getHostelPrincipalApproval,
    hydrateHostelGatePassesFromApi,
    approvalStatusColor,
} from '../../FrontOffice/HostelGatePass/hostelGatePassData'

/**
 * Parent approval inbox for their child's hostel leave / outing gate passes.
 * Parent OR Principal alone is enough (#45).
 */
const HostelOutingApprovals = () => {
    const { activeStudent } = useActiveStudent()
    const [records, setRecords] = useState(() => getHostelGatePasses())
    const [busyId, setBusyId] = useState('')

    const refresh = async () => {
        await hydrateHostelGatePassesFromApi().catch(() => null)
        setRecords(getHostelGatePasses())
    }

    useEffect(() => {
        refresh()
    }, [])

    const studentKeys = useMemo(() => {
        const keys = [
            activeStudent?.id,
            activeStudent?.admissionNumber,
            activeStudent?.admissionNo,
            activeStudent?.studentId,
        ]
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)
        return new Set(keys)
    }, [activeStudent])

    const pending = useMemo(() => {
        const filtered = filterHostelGatePasses(records, {})
        return filtered.filter((row) => {
            if ((row.parentApproval || 'Pending') !== 'Pending') return false
            if (!studentKeys.size) return true
            const rowKeys = [row.studentId, row.admissionNumber, row.admissionNo]
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
            return rowKeys.some((key) => studentKeys.has(key))
        })
    }, [records, studentKeys])

    const decide = async (id, status) => {
        setBusyId(id)
        try {
            const result = await decideHostelGatePassApproval(id, { actor: 'parent', status })
            if (!result.success) {
                toast.error(result.message || 'Could not update hostel outing.')
                return
            }
            toast.success(`Hostel outing ${status.toLowerCase()}.`)
            await refresh()
        } finally {
            setBusyId('')
        }
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <p className='text-sm text-[#667085] mb-2'>
                    Approve or reject hostel leave / outing requests for your child. Principal approval is an alternative — Warden is not required.
                </p>
                {!activeStudent ? (
                    <p className='text-sm text-[#B42318]'>Select a child to see pending outing requests.</p>
                ) : null}
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <h2 className='text-xl font-medium text-black mb-4'>Pending Hostel Outings</h2>
                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Gate Pass ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Leave Type</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Out</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Return</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Principal</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pending.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className='px-2 py-8 text-center text-[#667085]'>
                                        No pending hostel outing approvals.
                                    </td>
                                </tr>
                            ) : (
                                pending.map((row) => (
                                    <tr key={row.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                        <td className='px-2 py-4 font-medium text-[#515DEF] rounded-s-lg whitespace-nowrap'>{row.gatePassId || row.id}</td>
                                        <td className='px-2 py-4'>{row.studentName}</td>
                                        <td className='px-2 py-4 whitespace-nowrap'>{row.leaveType}</td>
                                        <td className='px-2 py-4 whitespace-nowrap'>
                                            {row.outDate} {formatOutTimeForDisplay(row.outTime)}
                                        </td>
                                        <td className='px-2 py-4 whitespace-nowrap'>
                                            {row.returnDate} {formatOutTimeForDisplay(row.returnTime)}
                                        </td>
                                        <td className='px-2 py-4'>
                                            <span className={`font-medium ${approvalStatusColor[getHostelPrincipalApproval(row)] || ''}`}>
                                                {getHostelPrincipalApproval(row)}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4 rounded-e-lg'>
                                            <div className='flex flex-wrap gap-2'>
                                                <button
                                                    type='button'
                                                    disabled={busyId === row.id}
                                                    onClick={() => decide(row.id, 'Approved')}
                                                    className='bg-[#4CAF50] text-white text-xs px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-60 cursor-pointer'
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type='button'
                                                    disabled={busyId === row.id}
                                                    onClick={() => decide(row.id, 'Rejected')}
                                                    className='bg-[#B42318] text-white text-xs px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-60 cursor-pointer'
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

export default HostelOutingApprovals
