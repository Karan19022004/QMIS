import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-toastify'
import {
    canUseApprovalsApi,
    decideApprovalApi,
    getApprovalApi,
} from '../../services/approvalsApi'

const statusBadgeColor = {
    Pending: 'bg-[#FF980033] text-[#FF9800]',
    Approved: 'bg-[#4CAF5033] text-[#4CAF50]',
    Rejected: 'bg-[#FF000033] text-[#FF0000]',
    Denied: 'bg-[#FF000033] text-[#FF0000]',
}

const statusLabel = (status) => {
    const value = String(status || '').toLowerCase()
    if (value === 'pending') return 'Pending'
    if (value === 'approved') return 'Approved'
    if (value === 'denied' || value === 'rejected') return 'Rejected'
    return status || '—'
}

const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleString('en-GB')
}

const Field = ({ label, value }) => (
    <div className="flex flex-col gap-y-1">
        <span className="text-base font-medium text-[#808080]">{label}</span>
        <span className="text-sm text-[#1E1E1E] whitespace-pre-wrap wrap-break-word">{value || '—'}</span>
    </div>
)

/**
 * Campus approval detail + decide (exam, marks, leave chain, etc.).
 * @param {{ listPath: string, roleLabel?: string }} props
 */
export default function ViewCampusApprovalPage({ listPath, roleLabel = 'Approver' }) {
    const { id } = useParams()
    const navigate = useNavigate()
    const [row, setRow] = useState(null)
    const [loading, setLoading] = useState(true)
    const [comment, setComment] = useState('')
    const [busy, setBusy] = useState(false)

    const load = async () => {
        if (!canUseApprovalsApi() || !id) {
            setRow(null)
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const data = await getApprovalApi(id)
            setRow(data)
        } catch (error) {
            toast.error(error?.message || 'Approval could not be loaded.')
            setRow(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const decide = async (decision) => {
        if (busy || !row) return
        let note = comment
        if (decision === 'deny') {
            if (!String(note).trim()) {
                toast.error('Add a remark explaining the rejection.')
                return
            }
        }
        setBusy(true)
        try {
            const updated = await decideApprovalApi(row.id, { decision, comment: note || null })
            setRow(updated)
            toast.success(decision === 'approve' ? 'Request approved.' : 'Request rejected.')
        } catch (error) {
            toast.error(error?.message || 'Decision failed.')
        } finally {
            setBusy(false)
        }
    }

    const label = statusLabel(row?.status)
    const pending = String(row?.status || '').toLowerCase() === 'pending'

    return (
        <section className="space-y-6">
            <button
                type="button"
                onClick={() => navigate(listPath)}
                className="inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer"
            >
                <ArrowLeft size={18} />
                Back to list
            </button>

            {loading ? (
                <div className="bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]">Loading approval…</div>
            ) : !row ? (
                <div className="bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]">
                    Approval not found or not available for this login.
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl shadow-md p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold text-black">{row.title || 'Approval request'}</h1>
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${statusBadgeColor[label] || 'bg-[#66708533] text-[#667085]'}`}>
                                {label}
                            </span>
                        </div>
                        <p className="text-sm text-[#667085] mt-2">
                            Waiting on {roleLabel}
                            {row.awaitingRole ? ` · current step: ${row.awaitingRole}` : ''}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-md p-4">
                        <h2 className="text-xl font-semibold text-black mb-6">Request details</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Field label="Approval ID" value={row.id} />
                            <Field label="Type" value={row.entityType} />
                            <Field label="Related record" value={row.entityId} />
                            <Field label="Submitted by role" value={row.initiatorRole} />
                            <Field label="Created" value={formatDate(row.createdAt)} />
                            <Field label="Status" value={label} />
                            <div className="lg:col-span-3">
                                <Field label="Title" value={row.title} />
                            </div>
                            <div className="lg:col-span-3">
                                <Field
                                    label="Approval chain"
                                    value={Array.isArray(row.chain) ? row.chain.join(' → ') : '—'}
                                />
                            </div>
                        </div>
                    </div>

                    {Array.isArray(row.events) && row.events.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-md p-4">
                            <h2 className="text-xl font-semibold text-black mb-4">Decision history</h2>
                            <ul className="space-y-3">
                                {row.events.map((event, index) => (
                                    <li key={`${event.action}-${index}`} className="text-sm text-[#1E1E1E] border-b border-[#F2F4F7] pb-2">
                                        <span className="font-medium">{event.action}</span>
                                        {' · '}
                                        {event.actorRole || '—'}
                                        {event.comment ? ` — ${event.comment}` : ''}
                                        <span className="block text-xs text-[#667085] mt-0.5">{formatDate(event.at || event.createdAt)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {pending && (
                        <div className="bg-white rounded-2xl shadow-md p-4 space-y-4">
                            <h2 className="text-xl font-semibold text-black">{roleLabel} decision</h2>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                placeholder="Remarks (required when rejecting)"
                                className="w-full text-sm border border-[#D9D9D9] rounded-md px-3 py-2"
                            />
                            <div className="flex sm:justify-end justify-center gap-x-4">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decide('deny')}
                                    className="bg-white text-[#FF0000] text-sm px-8 py-2 rounded-md border border-[#FF0000] hover:bg-[#FF0000] hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-60"
                                >
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decide('approve')}
                                    className="bg-[#4CAF50] text-white text-sm px-8 py-2 rounded-md border border-[#4CAF50] hover:opacity-90 transition-all duration-200 cursor-pointer disabled:opacity-60"
                                >
                                    {busy ? 'Saving…' : 'Approve'}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
