import React, { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { getEmployees, getExits, nextId, pushNotification, saveExits } from '../../Pages/HR/domain/hrStore'

/**
 * Employee-facing relieving / resignation application.
 * Creates the same exit record HR Exit Formalities reviews.
 */
export default function StaffRelievingApply({
    title = 'Apply for Relieving',
    description = 'Submit a relieving / resignation request. HR reviews clearance and exit formalities.',
}) {
    const auth = useAuth() || {}
    const employees = useMemo(() => getEmployees().filter((row) => row.status === 'Active'), [])
    const [employeeId, setEmployeeId] = useState('')
    const [lastWorkingDate, setLastWorkingDate] = useState('')
    const [exitType, setExitType] = useState('Resignation')
    const [reason, setReason] = useState('')
    const [saving, setSaving] = useState(false)

    const myApplications = useMemo(() => {
        const exits = getExits()
        const email = String(auth.email || '').toLowerCase()
        return exits.filter((row) => {
            if (!row?.employeeId) return false
            const emp = employees.find((item) => item.id === row.employeeId)
            if (employeeId && row.employeeId === employeeId) return true
            if (email && emp?.email && String(emp.email).toLowerCase() === email) return true
            return row.requestedByEmail && String(row.requestedByEmail).toLowerCase() === email
        })
    }, [auth.email, employeeId, employees, saving])

    const submit = (event) => {
        event.preventDefault()
        if (!employeeId) {
            toast.error('Select your employee record.')
            return
        }
        if (!lastWorkingDate) {
            toast.error('Last working date is required.')
            return
        }
        if (!reason.trim()) {
            toast.error('Reason is required.')
            return
        }
        setSaving(true)
        try {
            const record = {
                id: nextId('EXT-2026', getExits()),
                employeeId,
                lastWorkingDate,
                exitType,
                reason: reason.trim(),
                status: 'Pending HR',
                source: 'employee-application',
                requestedByEmail: auth.email || '',
                requestedAt: new Date().toISOString(),
                noticePeriod: '30 days',
                noticeServed: false,
                handover: false,
                assets: false,
                documents: false,
                finance: false,
                departmentClearance: false,
                hrClearance: false,
                exitInterview: false,
                exitInterviewResponse: null,
            }
            saveExits([record, ...getExits()])
            pushNotification({
                type: 'Exit',
                title: 'Staff relieving application',
                message: `${employeeId} applied for ${exitType}.`,
                relatedDate: lastWorkingDate,
            })
            setReason('')
            toast.success('Relieving application submitted to HR.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h1 className='text-xl font-semibold text-black'>{title}</h1>
                <p className='text-sm text-[#667085] mt-1'>{description}</p>
                <form onSubmit={submit} className='grid grid-cols-1 md:grid-cols-2 gap-3 mt-4'>
                    <label className='text-sm text-[#808080] flex flex-col gap-1'>
                        Employee
                        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className='border rounded-md px-2 py-2 text-sm' required>
                            <option value=''>Select employee</option>
                            {employees.map((row) => (
                                <option key={row.id} value={row.id}>{row.name} · {row.id}</option>
                            ))}
                        </select>
                    </label>
                    <label className='text-sm text-[#808080] flex flex-col gap-1'>
                        Last working date
                        <input type='date' value={lastWorkingDate} onChange={(event) => setLastWorkingDate(event.target.value)} className='border rounded-md px-2 py-2 text-sm' required />
                    </label>
                    <label className='text-sm text-[#808080] flex flex-col gap-1'>
                        Exit type
                        <select value={exitType} onChange={(event) => setExitType(event.target.value)} className='border rounded-md px-2 py-2 text-sm'>
                            <option>Resignation</option>
                            <option>Retirement</option>
                            <option>Transfer</option>
                        </select>
                    </label>
                    <label className='text-sm text-[#808080] flex flex-col gap-1 md:col-span-2'>
                        Reason
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} className='border rounded-md px-2 py-2 text-sm min-h-[80px]' required />
                    </label>
                    <button type='submit' disabled={saving} className='bg-[#515DEF] text-white rounded-md text-sm px-4 py-2 cursor-pointer disabled:opacity-50 md:col-span-2'>
                        {saving ? 'Submitting…' : 'Submit relieving application'}
                    </button>
                </form>
            </div>
            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <h2 className='text-lg font-medium mb-3'>My applications</h2>
                <table className='w-full text-sm'>
                    <thead className='text-xs bg-[#EDEEF5]'>
                        <tr>
                            {['ID', 'Type', 'Last working', 'Status', 'Reason'].map((label) => (
                                <th key={label} className='px-2 py-3 text-left text-[#0C1E5B]'>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {myApplications.length === 0 && (
                            <tr><td colSpan={5} className='px-2 py-6 text-center text-[#667085]'>No relieving applications yet.</td></tr>
                        )}
                        {myApplications.map((row) => (
                            <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                <td className='px-2 py-3'>{row.id}</td>
                                <td className='px-2 py-3'>{row.exitType}</td>
                                <td className='px-2 py-3'>{row.lastWorkingDate}</td>
                                <td className='px-2 py-3'>{row.status}</td>
                                <td className='px-2 py-3'>{row.reason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
