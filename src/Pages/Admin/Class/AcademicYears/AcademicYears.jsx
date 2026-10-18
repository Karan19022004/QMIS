import React, { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Plus } from 'lucide-react'
import {
    canUseClassDetailsApi,
    createAcademicYear,
    listAcademicYears,
    setAcademicYearCurrent,
} from '../../../../services/classDetailsApi'

const emptyForm = {
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
}

/**
 * Admin → Class Details → Academic Years.
 * Next years (e.g. 2027-28) are created here; they do not auto-create.
 * Set Current makes that year the default for new classes and catalog sync.
 */
const AcademicYears = () => {
    const apiMode = canUseClassDetailsApi()
    const [status, setStatus] = useState(apiMode ? 'loading' : 'idle')
    const [years, setYears] = useState([])
    const [error, setError] = useState('')
    const [form, setForm] = useState(emptyForm)
    const [formError, setFormError] = useState('')
    const [busy, setBusy] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    const reload = useCallback(() => setReloadKey((key) => key + 1), [])

    useEffect(() => {
        if (!apiMode) return undefined
        let cancelled = false
        setStatus('loading')
        listAcademicYears()
            .then((rows) => {
                if (!cancelled) {
                    setYears(rows)
                    setError('')
                    setStatus('ready')
                }
            })
            .catch((loadError) => {
                if (cancelled) return
                setStatus('error')
                setError(
                    loadError?.status === 403
                        ? 'You do not have permission to manage academic years.'
                        : loadError?.message || 'Could not load academic years.',
                )
            })
        return () => { cancelled = true }
    }, [apiMode, reloadKey])

    const handleCreate = async (event) => {
        event.preventDefault()
        setFormError('')
        const name = form.name.trim()
        if (name.length < 4) {
            setFormError('Name must be at least 4 characters (e.g. 2027-28).')
            return
        }
        setBusy(true)
        try {
            await createAcademicYear({
                name,
                startDate: form.startDate,
                endDate: form.endDate,
                isCurrent: form.isCurrent,
            })
            toast.success(`Academic year ${name} created.`)
            setForm(emptyForm)
            reload()
        } catch (createError) {
            setFormError(
                createError?.status === 403
                    ? 'You do not have permission to create academic years.'
                    : createError?.message || 'Could not create the academic year.',
            )
        } finally {
            setBusy(false)
        }
    }

    const handleSetCurrent = async (year) => {
        if (busy || year.isCurrent) return
        setBusy(true)
        try {
            await setAcademicYearCurrent(year.id)
            toast.success(`${year.name} is now the current academic year.`)
            reload()
        } catch (setError) {
            toast.error(setError?.message || 'Could not set the current year.')
        } finally {
            setBusy(false)
        }
    }

    if (!apiMode) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-6'>
                <h2 className='text-xl font-medium text-black'>Academic Years</h2>
                <p className='text-sm text-[#667085] mt-2'>
                    Academic year management needs the API Class Details mode. Turn on API auth / class masters,
                    then return here to add years such as 2027-28.
                </p>
            </section>
        )
    }

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Academic Years</h2>
                        <p className='text-sm text-[#667085] mt-1 max-w-2xl'>
                            Add the next year before creating classes for it. The current year is the default on
                            Add Class Details and is what other modules sync from. Years do not create themselves.
                        </p>
                    </div>
                    <NavLink
                        to='/admin/class/class-details'
                        className='text-sm text-[#515DEF] underline whitespace-nowrap'
                    >
                        Back to Class Details
                    </NavLink>
                </div>

                <form onSubmit={handleCreate} className='mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='year-name' className='text-base font-medium text-[#1E1E1E]'>Year name</label>
                        <input
                            id='year-name'
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder='e.g. 2027-28'
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='year-start' className='text-base font-medium text-[#1E1E1E]'>Start date (optional)</label>
                        <input
                            id='year-start'
                            type='date'
                            value={form.startDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='year-end' className='text-base font-medium text-[#1E1E1E]'>End date (optional)</label>
                        <input
                            id='year-end'
                            type='date'
                            value={form.endDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='flex items-center gap-2 text-sm font-medium text-[#1E1E1E] py-2'>
                            <input
                                type='checkbox'
                                checked={form.isCurrent}
                                onChange={(e) => setForm((prev) => ({ ...prev, isCurrent: e.target.checked }))}
                            />
                            Set as current when created
                        </label>
                        <button
                            type='submit'
                            disabled={busy}
                            className='bg-[#515DEF] text-white text-sm px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 cursor-pointer'
                        >
                            <Plus size={16} />
                            {busy ? 'Saving…' : 'Add Academic Year'}
                        </button>
                    </div>
                </form>
                {formError && <p role='alert' className='text-sm text-[#F44336] mt-3'>{formError}</p>}
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h3 className='text-lg font-medium text-black'>Years on this campus</h3>
                {status === 'loading' ? (
                    <p className='py-10 text-center text-sm text-[#667085]'>Loading academic years…</p>
                ) : status === 'error' ? (
                    <div role='alert' className='py-10 text-center'>
                        <p className='text-sm text-[#B42318]'>{error}</p>
                        <button
                            type='button'
                            onClick={reload}
                            className='mt-3 bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md cursor-pointer'
                        >
                            Retry
                        </button>
                    </div>
                ) : years.length === 0 ? (
                    <p className='py-10 text-center text-sm text-[#667085]'>No academic years yet. Add one above.</p>
                ) : (
                    <div className='relative overflow-x-auto mt-4'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Name</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Start</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>End</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {years.map((year) => (
                                    <tr key={year.id} className='border-b border-[#f2f4f7] text-[#667085]'>
                                        <td className='px-3 py-3 font-medium text-[#344054]'>{year.name}</td>
                                        <td className='px-3 py-3'>{year.startDate || '—'}</td>
                                        <td className='px-3 py-3'>{year.endDate || '—'}</td>
                                        <td className='px-3 py-3'>
                                            {year.isCurrent ? (
                                                <span className='inline-block text-xs px-2 py-1 rounded-full bg-[#ECFDF3] text-[#027A48]'>
                                                    Current
                                                </span>
                                            ) : (
                                                <span className='inline-block text-xs px-2 py-1 rounded-full bg-[#F2F4F7] text-[#667085]'>
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        <td className='px-3 py-3'>
                                            <button
                                                type='button'
                                                disabled={busy || year.isCurrent}
                                                onClick={() => handleSetCurrent(year)}
                                                className='text-sm text-[#515DEF] underline disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-not-allowed'
                                            >
                                                {year.isCurrent ? 'Current year' : 'Set as current'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    )
}

export default AcademicYears
