import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiMe } from '../../services/authApi'
import { apiRequest, getAccessToken, isApiAuthEnabled } from '../../services/apiClient'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-sm font-medium text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] break-words'>{value || '—'}</span>
    </div>
)

const Card = ({ title, children, action }) => (
    <div className='bg-white rounded-2xl shadow-md p-4'>
        <div className='flex items-start justify-between gap-3 mb-4'>
            <h2 className='text-lg font-semibold text-black'>{title}</h2>
            {action}
        </div>
        {children}
    </div>
)

const findEmployee = (rows, email) => {
    const key = String(email || '').trim().toLowerCase()
    if (!key) return null
    return (Array.isArray(rows) ? rows : []).find(
        (row) => String(row.email || '').trim().toLowerCase() === key,
    ) || null
}

/**
 * Staff My Profile — loads /auth/me + matching HR portal employee (DB).
 */
export default function MyProfilePage({
    roleLabel = 'Staff',
    attendancePath = '',
    leavePath = '',
}) {
    const { email, name, role } = useAuth()
    const api = isApiAuthEnabled() && Boolean(getAccessToken())
    const [loading, setLoading] = useState(api)
    const [error, setError] = useState('')
    const [me, setMe] = useState(null)
    const [employee, setEmployee] = useState(null)

    useEffect(() => {
        if (!api) {
            setLoading(false)
            setError('Sign in with API auth enabled to load your profile from the database.')
            return undefined
        }
        let cancelled = false
        setLoading(true)
        setError('')
        Promise.allSettled([
            apiMe(),
            apiRequest('/hr/portal/employees'),
        ]).then(([meResult, empResult]) => {
            if (cancelled) return
            if (meResult.status === 'fulfilled') setMe(meResult.value)
            else setError(meResult.reason?.message || 'Could not load account profile.')

            if (empResult.status === 'fulfilled') {
                setEmployee(findEmployee(empResult.value, email || meResult.value?.email))
            } else {
                setEmployee(null)
            }
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [api, email])

    const displayName = employee?.name || name || me?.full_name || me?.role_name || '—'
    const displayEmail = employee?.email || email || me?.email || '—'
    const campusName = me?.campus?.name || employee?.campus || '—'
    const department = employee?.department || employee?.departmentName || '—'
    const designation = employee?.designation || employee?.role || roleLabel || role || '—'
    const employeeId = employee?.id || employee?.employeeId || employee?.staffCode || '—'
    const phone = employee?.phone || employee?.mobile || employee?.mobileNumber || '—'
    const joiningDate = employee?.joiningDate || employee?.dateOfJoining || '—'
    const status = employee?.status || (me?.is_active === false ? 'Inactive' : 'Active')

    if (loading) {
        return <p className='text-[#667085]'>Loading profile…</p>
    }

    return (
        <section className='space-y-4'>
            {error ? <p className='text-sm text-[#B42318]'>{error}</p> : null}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h1 className='text-2xl font-semibold text-black'>{displayName}</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    {designation}
                    {campusName !== '—' ? ` · ${campusName}` : ''}
                </p>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                <Card title='Personal Details'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        <Field label='Full Name' value={displayName} />
                        <Field label='Email' value={displayEmail} />
                        <Field label='Phone' value={phone} />
                        <Field label='Role' value={me?.role_name || roleLabel || role} />
                    </div>
                </Card>

                <Card title='Employment Details'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        <Field label='Employee ID' value={employeeId} />
                        <Field label='Department' value={department} />
                        <Field label='Designation' value={designation} />
                        <Field label='Joining Date' value={joiningDate} />
                        <Field label='Campus' value={campusName} />
                        <Field label='Status' value={status} />
                    </div>
                    {!employee && api ? (
                        <p className='text-sm text-[#B54708] mt-4'>
                            No HR employee record is linked to this login email yet. Ask HR to set the same email on your employee profile.
                        </p>
                    ) : null}
                </Card>

                <Card
                    title='Attendance'
                    action={attendancePath ? (
                        <NavLink to={attendancePath} className='text-sm text-[#515DEF] hover:underline'>
                            Open My Attendance
                        </NavLink>
                    ) : null}
                >
                    <p className='text-sm text-[#667085]'>
                        Daily punches are stored in HR attendance. Use My Attendance for the live register.
                    </p>
                </Card>

                <Card
                    title='Leave Requests'
                    action={leavePath ? (
                        <NavLink to={leavePath} className='text-sm text-[#515DEF] hover:underline'>
                            Open My Leave
                        </NavLink>
                    ) : null}
                >
                    <p className='text-sm text-[#667085]'>
                        Leave history and approvals use the shared leave database. Open My Leave Requests to view or submit.
                    </p>
                </Card>
            </div>
        </section>
    )
}
