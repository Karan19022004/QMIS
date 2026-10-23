import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ChevronLeft, ChevronRight, EllipsisIcon } from 'lucide-react'
import Dropdown from '../CommonComponents/Dropdown'
import {
    canUseApprovalsApi,
    decideApprovalApi,
    listApprovalsInboxApi,
} from '../../services/approvalsApi'

const statusBadgeColor = {
    Pending: 'bg-[#FF980033] text-[#FF9800]',
    Approved: 'bg-[#4CAF5033] text-[#4CAF50]',
    Rejected: 'bg-[#FF000033] text-[#FF0000]',
}

const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleDateString('en-GB').replace(/\//g, '-')
}

const statusLabel = (status) => {
    const value = String(status || '').toLowerCase()
    if (value === 'pending') return 'Pending'
    if (value === 'approved') return 'Approved'
    if (value === 'denied' || value === 'rejected') return 'Rejected'
    return status || '—'
}

/**
 * @param {{ viewBasePath: string, emptyLabel?: string, description?: string }} props
 */
export default function CampusApprovalsInbox({
    viewBasePath,
    emptyLabel = 'No approval requests waiting for this role.',
    description = 'Live campus approvals from the server inbox.',
}) {
    const api = canUseApprovalsApi()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(api)

    const refresh = async () => {
        if (!api) {
            setRows([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const inbox = await listApprovalsInboxApi()
            setRows(
                (Array.isArray(inbox) ? inbox : []).map((row) => ({
                    id: row.id,
                    requestId: String(row.id).slice(0, 8).toUpperCase(),
                    requestDate: formatDate(row.createdAt),
                    purpose: row.title || `${row.entityType} · ${row.entityId}`,
                    entityType: row.entityType || '',
                    requestedBy: row.initiatorRole || '—',
                    status: statusLabel(row.status),
                    rawStatus: row.status,
                })),
            )
        } catch (error) {
            toast.error(error?.message || 'Approvals inbox could not be loaded.')
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((row) => {
            if (statusFilter && String(row.status).toLowerCase() !== statusFilter.toLowerCase()) return false
            if (!query) return true
            return [row.requestId, row.purpose, row.requestedBy, row.entityType, row.status]
                .join(' ')
                .toLowerCase()
                .includes(query)
        })
    }, [rows, search, statusFilter])

    const handleDecide = async (row, decision) => {
        let comment
        if (decision === 'deny') {
            comment = window.prompt('Rejection reason (required):', '')
            if (comment == null) return
            if (!String(comment).trim()) {
                toast.error('A rejection reason is required.')
                return
            }
        }
        try {
            await decideApprovalApi(row.id, { decision, comment })
            toast.success(decision === 'approve' ? 'Request approved.' : 'Request rejected.')
            await refresh()
        } catch (error) {
            toast.error(error?.message || 'Decision failed.')
        }
    }

    if (!api) {
        return (
            <section className="bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]">
                Sign in through the API to load live approval requests for this role.
            </section>
        )
    }

    return (
        <section>
            <div className="bg-white rounded-2xl shadow-md p-4">
                <p className="text-sm text-[#667085] mb-4">{description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-y-2">
                        <label className="text-base font-medium text-[#808080]">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Request ID, purpose..."
                            className="text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full"
                        />
                    </div>
                    <div className="flex flex-col gap-y-2">
                        <label className="text-base font-medium text-[#808080]">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full"
                        >
                            <option value="">All</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('')
                                setStatusFilter('')
                            }}
                            className="bg-[#515DEF] text-white text-sm px-6 py-2 rounded-lg cursor-pointer"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-4 mt-8">
                <h2 className="text-xl font-medium text-black mb-4">Request Approvals</h2>
                <div className="relative overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs bg-[#EDEEF5]">
                            <tr>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Request ID</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Date</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Purpose</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Type</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">From</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Status</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-2 py-8 text-center text-[#667085]">
                                        Loading approvals…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-2 py-8 text-center text-[#667085]">
                                        {emptyLabel}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((request) => (
                                    <tr key={request.id} className="border-b border-[#f2f4f7] text-[#667085]">
                                        <td className="px-2 py-4 font-medium text-[#1E1E1E]">{request.requestId}</td>
                                        <td className="px-2 py-4">{request.requestDate}</td>
                                        <td className="px-2 py-4 max-w-[220px] truncate" title={request.purpose}>
                                            {request.purpose}
                                        </td>
                                        <td className="px-2 py-4">{request.entityType || '—'}</td>
                                        <td className="px-2 py-4">{request.requestedBy}</td>
                                        <td className="px-2 py-4">
                                            <span
                                                className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusBadgeColor[request.status] || 'bg-[#66708533] text-[#667085]'}`}
                                            >
                                                {request.status}
                                            </span>
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <Dropdown buttonContent={<EllipsisIcon size={16} className="text-black" />}>
                                                <NavLink
                                                    to={`${viewBasePath}/${request.id}`}
                                                    className="w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer block"
                                                >
                                                    View / Decide
                                                </NavLink>
                                                {request.rawStatus === 'pending' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDecide(request, 'approve')}
                                                            className="w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDecide(request, 'deny')}
                                                            className="w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                            </Dropdown>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-between items-center px-4 mt-4">
                <p className="text-sm font-medium text-[#515DEF]">
                    Showing {filtered.length} of {rows.length} entries
                </p>
                <div className="flex gap-x-2">
                    <button type="button" className="size-8 flex justify-center items-center bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full">
                        <ChevronLeft size={16} />
                    </button>
                    <button type="button" className="size-8 flex justify-center items-center bg-[#EDEDF5] text-[#515DEF] border border-[#E2E8F0] rounded-full">
                        1
                    </button>
                    <button type="button" className="size-8 flex justify-center items-center bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </section>
    )
}
