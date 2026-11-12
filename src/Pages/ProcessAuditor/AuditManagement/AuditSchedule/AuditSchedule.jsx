import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Download, LayoutList, CalendarDays, Search } from 'lucide-react'
import ExportModal from '../../../../Common/CommonComponents/ExportModal'
import AuditScheduleCalendar from './AuditScheduleCalendar'
import {
    getAuditSchedules,
    addAuditSchedule,
    hydrateFromApi,
    DEPARTMENTS,
    FREQUENCIES,
    SCHEDULE_STATUSES,
    statusBadgeColor,
} from './auditScheduleData'
import { AUDIT_COMPONENTS_KEY, COMPONENT_SEED } from '../../../../Common/demoDomain/auditSeeds'
import { ensureSeed } from '../../../../Common/demoDomain/storage'

const parseDmy = (value) => {
    if (!value) return null
    const [day, month, year] = String(value).split('-').map(Number)
    if (!day || !month || !year) return null
    return new Date(year, month - 1, day)
}

const AuditSchedule = () => {
    const location = useLocation()
    const [schedules, setSchedules] = useState(() => getAuditSchedules())
    const [viewMode, setViewMode] = useState('list')
    const [searchInput, setSearchInput] = useState('')
    const [appliedSearch, setAppliedSearch] = useState('')
    const [department, setDepartment] = useState('')
    const [frequency, setFrequency] = useState('')
    const [status, setStatus] = useState('')
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [exportModal, setExportModal] = useState(false)
    const [recurring, setRecurring] = useState(false)
    const [recurrenceType, setRecurrenceType] = useState('Weekly')
    const [componentId, setComponentId] = useState('')
    const components = useMemo(() => ensureSeed(AUDIT_COMPONENTS_KEY, COMPONENT_SEED), [])

    const refresh = () => setSchedules(getAuditSchedules())

    const createSchedule = (event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const iso = String(data.get('startDate') || '')
        const [year, month, day] = iso.split('-')
        const selected = components.find((row) => row.id === componentId)
        addAuditSchedule({
            auditName: data.get('auditName'),
            department: data.get('department'),
            isRecurring: data.get('isRecurring') === 'yes',
            recurrenceType: data.get('recurrenceType'),
            dayOfWeek: Number(data.get('dayOfWeek')),
            dayOfMonth: Number(data.get('dayOfMonth')),
            startDate: day && month && year ? `${day}-${month}-${year}` : iso,
            endDate: '',
            componentId: selected?.id || '',
            componentName: selected?.component || '',
            rubric1: selected?.rubric1 || '',
            rubric2: selected?.rubric2 || '',
            rubric3: selected?.rubric3 || '',
            rubric4: selected?.rubric4 || '',
        })
        refresh()
        event.currentTarget.reset()
        setRecurring(false)
        setComponentId('')
    }

    const clearFilters = () => {
        setSearchInput('')
        setAppliedSearch('')
        setDepartment('')
        setFrequency('')
        setStatus('')
        setFromDate(null)
        setToDate(null)
    }

    const applySearch = () => setAppliedSearch(searchInput.trim())

    useEffect(() => {
        let active = true
        hydrateFromApi().finally(() => {
            if (active) refresh()
        })
        return () => { active = false }
    }, [location.pathname])

    const filtered = useMemo(() => {
        const query = appliedSearch.toLowerCase()
        const norm = (value) => String(value || '').toUpperCase().replace(/[\s_-]/g, '')
        return schedules.filter((record) => {
            if (department && record.department !== department) return false
            if (frequency && norm(record.frequency) !== norm(frequency)) return false
            if (status && record.status !== status) return false
            if (fromDate || toDate) {
                const due = parseDmy(record.dueDate || record.assignedDate)
                if (fromDate && due && due < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) return false
                if (toDate && due && due > new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59)) return false
            }
            if (!query) return true
            return [record.scheduleId, record.auditId, record.auditName, record.assignedBy, record.department]
                .some((value) => String(value || '').toLowerCase().includes(query))
        })
    }, [schedules, appliedSearch, department, frequency, status, fromDate, toDate])

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap items-center justify-between gap-4 mb-4'>
                    <p className='text-sm text-[#667085]'>
                        Displays upcoming audit schedules.
                    </p>
                    <div className='flex rounded-lg border border-[#D9D9D9] overflow-hidden text-sm font-medium'>
                        <button
                            type='button'
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 px-4 py-2 transition cursor-pointer ${viewMode === 'list'
                                ? 'bg-[#515DEF] text-white'
                                : 'text-[#667085] hover:bg-[#f2f4f7]'
                                }`}
                        >
                            <LayoutList size={16} />
                            List
                        </button>
                        <button
                            type='button'
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 px-4 py-2 transition cursor-pointer ${viewMode === 'calendar'
                                ? 'bg-[#515DEF] text-white'
                                : 'text-[#667085] hover:bg-[#f2f4f7]'
                                }`}
                        >
                            <CalendarDays size={16} />
                            Calendar
                        </button>
                    </div>
                </div>

                {viewMode === 'list' && (
                    <>
                        <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                            <button type='button' onClick={clearFilters} className='bg-[#515DEF] text-white uppercase text-sm px-6 py-1.5 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'>
                                Clear Filters
                            </button>
                        </div>
                        <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                            <div className='flex flex-col gap-y-2'>
                                <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                                <div className='flex gap-2'>
                                    <input
                                        type='text'
                                        id='search'
                                        value={searchInput}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                        onKeyDown={(event) => { if (event.key === 'Enter') applySearch() }}
                                        placeholder='Schedule ID, audit ID, audit name...'
                                        className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                    />
                                    <button
                                        type='button'
                                        onClick={applySearch}
                                        className='shrink-0 bg-[#515DEF] text-white text-sm px-3 py-2 rounded-md hover:opacity-90 cursor-pointer inline-flex items-center gap-1'
                                    >
                                        <Search size={14} />
                                        Search
                                    </button>
                                </div>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label htmlFor='department-filter' className='text-base font-medium text-[#808080]'>Department</label>
                                <select id='department-filter' value={department} onChange={(event) => setDepartment(event.target.value)} className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'>
                                    <option value=''>All</option>
                                    {DEPARTMENTS.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label htmlFor='frequency-filter' className='text-base font-medium text-[#808080]'>Frequency</label>
                                <select id='frequency-filter' value={frequency} onChange={(event) => setFrequency(event.target.value)} className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'>
                                    <option value=''>All</option>
                                    {FREQUENCIES.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label htmlFor='status-filter' className='text-base font-medium text-[#808080]'>Status</label>
                                <select id='status-filter' value={status} onChange={(event) => setStatus(event.target.value)} className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'>
                                    <option value=''>All</option>
                                    {SCHEDULE_STATUSES.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>From</label>
                                <div className='relative w-full'>
                                    <DatePicker
                                        selected={fromDate}
                                        onChange={(date) => setFromDate(date)}
                                        isClearable
                                        showMonthYearDropdown
                                        scrollableMonthYearDropdown
                                        className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                                    />
                                    <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                                </div>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>To</label>
                                <div className='relative'>
                                    <DatePicker
                                        selected={toDate}
                                        onChange={(date) => setToDate(date)}
                                        isClearable
                                        showMonthYearDropdown
                                        scrollableMonthYearDropdown
                                        className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                                    />
                                    <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <form onSubmit={createSchedule} className='bg-white rounded-2xl shadow-md p-4 mt-8 grid md:grid-cols-3 gap-3'>
                <h2 className='md:col-span-3 text-lg font-medium'>Create schedule</h2>
                <p className='md:col-span-3 text-xs text-[#667085]'>Attach component + Rubric-1..4 with the schedule so observations can use them together.</p>
                <input name='auditName' required placeholder='Schedule name' className='border rounded-md px-2 py-2 text-sm' />
                <select name='department' className='border rounded-md px-2 py-2 text-sm'>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select>
                <input name='startDate' type='date' required className='border rounded-md px-2 py-2 text-sm' />
                <select value={componentId} onChange={(event) => setComponentId(event.target.value)} className='border rounded-md px-2 py-2 text-sm md:col-span-2'>
                    <option value=''>Select component (with rubrics)</option>
                    {components.map((row) => (
                        <option key={row.id} value={row.id}>
                            {row.component}{row.subComponent ? ` / ${row.subComponent}` : ''}
                        </option>
                    ))}
                </select>
                <select name='isRecurring' value={recurring ? 'yes' : 'no'} onChange={(event) => setRecurring(event.target.value === 'yes')} className='border rounded-md px-2 py-2 text-sm'>
                    <option value='no'>One-time</option>
                    <option value='yes'>Recurring</option>
                </select>
                {recurring && (
                    <select name='recurrenceType' value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value)} className='border rounded-md px-2 py-2 text-sm'>
                        <option>Weekly</option>
                        <option>Monthly</option>
                    </select>
                )}
                {recurring && recurrenceType === 'Weekly' && (
                    <select name='dayOfWeek' className='border rounded-md px-2 py-2 text-sm'>
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}
                    </select>
                )}
                {recurring && recurrenceType === 'Monthly' && <input name='dayOfMonth' type='number' min='1' max='31' required placeholder='Day of month' className='border rounded-md px-2 py-2 text-sm' />}
                <button type='submit' className='bg-[#515DEF] text-white text-sm rounded-md cursor-pointer'>Save schedule</button>
            </form>

            {viewMode === 'list' ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                        <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                            <h2 className='text-xl font-medium text-black'>Audit Schedule List</h2>
                            <button
                                type='button'
                                onClick={() => setExportModal(true)}
                                className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                            >
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left rtl:text-right'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                    <tr className='rounded-lg'>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Schedule ID</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Audit ID</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Audit Name</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Assigned Date</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Due Date</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Assigned By</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className='px-2 py-8 text-center text-[#667085]'>No schedules match the filters.</td>
                                        </tr>
                                    ) : filtered.map((record) => (
                                        <tr key={record.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'>
                                            <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{record.scheduleId}</td>
                                            <td className='px-2 py-4 font-medium text-[#515DEF] whitespace-nowrap'>{record.auditId}</td>
                                            <td className='px-2 py-4 font-medium text-[#1E1E1E] max-w-[180px] truncate' title={record.auditName}>{record.auditName}</td>
                                            <td className='px-2 py-4 whitespace-nowrap'>{record.assignedDate}</td>
                                            <td className='px-2 py-4 whitespace-nowrap'>{record.dueDate}</td>
                                            <td className='px-2 py-4'>{record.assignedBy}</td>
                                            <td className='px-2 py-4 rounded-e-lg'>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusBadgeColor[record.status]}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className='flex justify-between items-center px-4 mt-4'>
                        <p className='text-sm font-medium text-[#515DEF]'>
                            Showing 1 to {filtered.length} of {filtered.length} entries
                        </p>
                        <div className='flex justify-center gap-x-2 flex-wrap'>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'>
                                <ChevronLeft size={16} />
                            </button>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full cursor-pointer'>
                                1
                            </button>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className='mt-8'>
                    <AuditScheduleCalendar />
                </div>
            )}

            <ExportModal
                exportModal={exportModal}
                setExportModal={setExportModal}
                rows={filtered}
                columns={[
                    { key: 'scheduleId', label: 'Schedule ID' },
                    { key: 'auditId', label: 'Audit ID' },
                    { key: 'auditName', label: 'Audit Name' },
                    { key: 'assignedDate', label: 'Assigned Date' },
                    { key: 'dueDate', label: 'Due Date' },
                    { key: 'assignedBy', label: 'Assigned By' },
                    { key: 'status', label: 'Status' },
                ]}
                filename='audit-schedule'
                title='Audit Schedule'
                exportDescription={<>You are exporting {filtered.length} record(s) for the selected filters and date range.</>}
            />
        </section>
    )
}

export default AuditSchedule
