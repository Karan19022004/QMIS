import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/roles'
import { IT_TICKETS_KEY, raiseTicket } from '../demoDomain/itTickets'
import { usesCampusApiForKey } from '../../services/campusJsonStore'

const ROLE_LABEL = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.ADMIN]: 'Admin',
    [ROLES.TEACHER]: 'Teacher',
    [ROLES.COORDINATOR]: 'Coordinator',
    [ROLES.PRINCIPAL]: 'Principal',
    [ROLES.DIRECTOR]: 'Director',
    [ROLES.STUDENT]: 'Student',
    [ROLES.PARENT]: 'Parent',
    [ROLES.HR]: 'HR',
    [ROLES.ACCOUNT_HEAD]: 'Finance Head',
    [ROLES.TRANSPORT_MANAGER]: 'Transport Manager',
    [ROLES.HOUSEKEEPING_MANAGER]: 'Housekeeping Manager',
    [ROLES.MAINTENANCE_MANAGER]: 'Maintenance Manager',
    [ROLES.IT_SUPPORT_MANAGER]: 'IT Support Manager',
    [ROLES.GATEKEEPER]: 'Gate Keeper',
    [ROLES.GATEKEEPER_MANAGER]: 'Gate Keeper Manager',
    [ROLES.STATIONERY_STORE_MANAGER]: 'Stationery Store Manager',
    [ROLES.CANTEEN_MANAGER]: 'Canteen Manager',
}

const CATEGORIES = [
    'Hardware',
    'Software',
    'Network',
    'Printer',
    'Housekeeping',
    'Facilities / Maintenance',
    'Stationery / Stores',
    'Transport',
    'Canteen',
    'Other',
]

const DEPARTMENTS = [
    'IT Support',
    'Housekeeping',
    'Facilities',
    'Stationery Store',
    'Transport',
    'Canteen',
    'Academics',
    'Front Office',
    'HR',
    'Finance',
    'General',
]

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const inputClass = 'text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full'

export default function RaiseItTicketModal({ open, onClose }) {
    const { role, name, email } = useAuth()
    const [form, setForm] = useState({
        category: 'Hardware',
        subject: '',
        description: '',
        priority: 'Medium',
        department: 'IT Support',
        assetId: '',
        attachmentName: '',
    })
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null

    const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

    const submit = async (event) => {
        event.preventDefault()
        if (busy) return
        if (!form.subject.trim() || !form.description.trim()) {
            toast.error('Subject and description are required.')
            return
        }
        setBusy(true)
        try {
            const ticket = await raiseTicket({
                requesterName: name || email || 'Demo User',
                requesterRole: ROLE_LABEL[role] || role || 'User',
                requesterEmail: email || '',
                department: form.department || 'General',
                issueType: form.category,
                subject: form.subject.trim(),
                description: form.description.trim(),
                priority: form.priority,
                assetId: form.assetId,
                attachmentName: form.attachmentName,
            })
            toast.success(`Request ${ticket.ticketId} submitted.`)
            setForm({
                category: 'Hardware',
                subject: '',
                description: '',
                priority: 'Medium',
                department: 'IT Support',
                assetId: '',
                attachmentName: '',
            })
            onClose()
        } catch (error) {
            toast.error(error?.message || 'The request could not be sent. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            <button type='button' className='absolute inset-0 bg-black/40' onClick={onClose} aria-label='Close' />
            <form onSubmit={submit} className='relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-lg p-5'>
                <h3 className='text-lg font-semibold text-black'>Raise Ticket</h3>
                <p className='text-xs text-[#667085] mt-1'>
                    {usesCampusApiForKey(IT_TICKETS_KEY)
                        ? 'Raise a ticket for any department (IT, Housekeeping, Stores, Transport, and more). Track it under My Tickets.'
                        : 'Pick the target department and category. The ticket is routed to that department inbox.'}
                </p>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4'>
                    <label className='text-sm flex flex-col gap-1'>Department
                        <select value={form.department} onChange={set('department')} className={inputClass}>
                            {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
                        </select>
                    </label>
                    <label className='text-sm flex flex-col gap-1'>Category
                        <select value={form.category} onChange={set('category')} className={inputClass}>
                            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                        </select>
                    </label>
                    <label className='text-sm flex flex-col gap-1 sm:col-span-2'>Priority
                        <select value={form.priority} onChange={set('priority')} className={inputClass}>
                            {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
                        </select>
                    </label>
                    <label className='text-sm flex flex-col gap-1 sm:col-span-2'>Subject
                        <input value={form.subject} onChange={set('subject')} className={inputClass} />
                    </label>
                    <label className='text-sm flex flex-col gap-1 sm:col-span-2'>Description
                        <textarea rows={3} value={form.description} onChange={set('description')} className={inputClass} />
                    </label>
                    <label className='text-sm flex flex-col gap-1'>Asset (optional)
                        <input value={form.assetId} onChange={set('assetId')} placeholder='AST-2026-0142' className={inputClass} />
                    </label>
                    <label className='text-sm flex flex-col gap-1'>Attachment
                        <input
                            type='file'
                            accept='image/png,image/jpeg,image/*,.png,.jpg,.jpeg,.pdf,application/pdf'
                            className={inputClass}
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                setForm((prev) => ({ ...prev, attachmentName: file?.name || '' }))
                            }}
                        />
                        {form.attachmentName ? (
                            <span className='text-xs text-[#667085]'>Selected: {form.attachmentName}</span>
                        ) : null}
                    </label>
                </div>
                <div className='flex justify-end gap-3 mt-5'>
                    <button type='button' onClick={onClose} className='border border-[#515DEF] text-[#515DEF] px-4 py-2 rounded-md text-sm cursor-pointer'>Cancel</button>
                    <button type='submit' disabled={busy} className='bg-[#515DEF] text-white px-4 py-2 rounded-md text-sm cursor-pointer disabled:opacity-60'>
                        {busy ? 'Sending…' : 'Submit Request'}
                    </button>
                </div>
            </form>
        </div>
    )
}
