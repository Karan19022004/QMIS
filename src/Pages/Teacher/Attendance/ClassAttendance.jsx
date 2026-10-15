import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Download, Save } from 'lucide-react'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { listAttendanceApi, upsertAttendanceApi } from '../../../services/attendanceApi'
import { isApiAttendanceEnabled } from '../../../services/apiClient'
import {
    ATTENDANCE_LIST,
    ATTENDANCE_STATUSES,
    CLASSES,
    SECTIONS,
    statusBadgeColor,
    inOutStatusBadgeColor,
} from './attendanceData'

const toIsoDate = (value) => {
    if (!value) return ''
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const ClassAttendance = () => {
    const api = isApiAttendanceEnabled()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [exportModal, setExportModal] = useState(false)
    const [classFilter, setClassFilter] = useState('')
    const [sectionFilter, setSectionFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState(ATTENDANCE_LIST)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [saveMessage, setSaveMessage] = useState('')
    const [dirty, setDirty] = useState(false)

    const canEdit = api && Boolean(classFilter)

    const reload = () => {
        if (!api) {
            setRows(ATTENDANCE_LIST)
            setLoading(false)
            setError('')
            return Promise.resolve()
        }
        setLoading(true)
        setError('')
        const date = toIsoDate(selectedDate)
        return listAttendanceApi({
            date,
            className: classFilter || undefined,
            section: sectionFilter || undefined,
            roster: Boolean(classFilter),
        })
            .then((data) => {
                setRows(Array.isArray(data) ? data : [])
                setDirty(false)
            })
            .catch((err) => {
                setError(err.message || 'Failed to load attendance')
                setRows([])
            })
            .finally(() => {
                setLoading(false)
            })
    }

    useEffect(() => {
        let cancelled = false
        setSaveMessage('')
        if (!api) {
            setRows(ATTENDANCE_LIST)
            return undefined
        }
        setLoading(true)
        setError('')
        const date = toIsoDate(selectedDate)
        listAttendanceApi({
            date,
            className: classFilter || undefined,
            section: sectionFilter || undefined,
            roster: Boolean(classFilter),
        })
            .then((data) => {
                if (!cancelled) {
                    setRows(Array.isArray(data) ? data : [])
                    setDirty(false)
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message || 'Failed to load attendance')
                    setRows([])
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [api, selectedDate, classFilter, sectionFilter])

    const displayRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((record) => {
            if (statusFilter && record.attendanceStatus !== statusFilter) return false
            if (!query) return true
            const haystack = `${record.admissionNumber || ''} ${record.studentId || ''} ${record.studentName || ''}`.toLowerCase()
            return haystack.includes(query)
        })
    }, [rows, search, statusFilter])

    const updateRowStatus = (studentId, attendanceStatus) => {
        setRows((current) =>
            current.map((row) =>
                String(row.studentId) === String(studentId) ? { ...row, attendanceStatus } : row,
            ),
        )
        setDirty(true)
        setSaveMessage('')
    }

    const markAll = (attendanceStatus) => {
        setRows((current) => current.map((row) => ({ ...row, attendanceStatus })))
        setDirty(true)
        setSaveMessage('')
    }

    const handleSave = async () => {
        if (!canEdit || saving) return
        const marks = rows
            .filter((row) => row.studentId && row.attendanceStatus)
            .map((row) => ({
                studentId: row.studentId,
                status: row.attendanceStatus,
                inOutStatus: row.inOutStatus && row.inOutStatus !== '—' ? row.inOutStatus : undefined,
            }))
        if (marks.length === 0) {
            setSaveMessage('Set Present/Absent for at least one student before saving.')
            return
        }
        setSaving(true)
        setError('')
        setSaveMessage('')
        try {
            await upsertAttendanceApi({
                date: toIsoDate(selectedDate),
                className: classFilter,
                section: sectionFilter || undefined,
                marks,
            })
            setSaveMessage(`Saved attendance for ${marks.length} student(s).`)
            await reload()
        } catch (err) {
            setError(err.message || 'Failed to save attendance')
        } finally {
            setSaving(false)
        }
    }

    const clearFilters = () => {
        setClassFilter('')
        setSectionFilter('')
        setStatusFilter('')
        setSearch('')
        setSelectedDate(new Date())
        setSaveMessage('')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={clearFilters}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-1.5 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    {api && (
                        <p className='text-sm text-[#667085]'>
                            Select a class to load the roster, mark Present/Absent, then Save.
                        </p>
                    )}
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            id='search'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Student ID, name...'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='class-filter' className='text-base font-medium text-[#808080]'>Class</label>
                        <select
                            id='class-filter'
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {CLASSES.map((item) => (
                                <option key={item} value={item}>Class {item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='section-filter' className='text-base font-medium text-[#808080]'>Section</label>
                        <select
                            id='section-filter'
                            value={sectionFilter}
                            onChange={(e) => setSectionFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {SECTIONS.map((item) => (
                                <option key={item} value={item}>Section {item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status-filter' className='text-base font-medium text-[#808080]'>Attendance Status</label>
                        <select
                            id='status-filter'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {ATTENDANCE_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={selectedDate}
                                onChange={(date) => setSelectedDate(date)}
                                isClearable
                                showMonthYearDropdown
                                scrollableMonthYearDropdown
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Attendance List</h2>
                        {saveMessage && <p className='text-sm text-[#027A48] mt-1'>{saveMessage}</p>}
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        {canEdit && (
                            <>
                                <button
                                    type='button'
                                    onClick={() => markAll('Present')}
                                    className='bg-white text-[#4CAF50] text-sm px-3 py-2 rounded-md border border-[#4CAF50] hover:opacity-90 cursor-pointer'
                                >
                                    Mark all Present
                                </button>
                                <button
                                    type='button'
                                    onClick={() => markAll('Absent')}
                                    className='bg-white text-[#B42318] text-sm px-3 py-2 rounded-md border border-[#B42318] hover:opacity-90 cursor-pointer'
                                >
                                    Mark all Absent
                                </button>
                                <button
                                    type='button'
                                    disabled={saving || !dirty}
                                    onClick={handleSave}
                                    className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2 disabled:opacity-60'
                                >
                                    <Save size={16} />
                                    {saving ? 'Saving…' : 'Save attendance'}
                                </button>
                            </>
                        )}
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>
                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left rtl:text-right'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr className='rounded-lg'>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Student ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student Name</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Section</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Time</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Attendance Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>In & out Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className='px-2 py-10 text-center text-[#667085]'>Loading attendance…</td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={7} className='px-2 py-10 text-center text-red-500'>{error}</td>
                                </tr>
                            )}
                            {!loading && !error && displayRows.length === 0 && (
                                <tr>
                                    <td colSpan={7} className='px-2 py-10 text-center text-[#667085]'>
                                        {api && !classFilter
                                            ? 'Select a class to load the roster and mark attendance.'
                                            : 'No attendance marks for this date.'}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && displayRows.map((record) => (
                                <tr key={record.id || record.studentId} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'>
                                    <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{record.admissionNumber || record.studentId}</td>
                                    <td className='px-2 py-4 font-medium text-[#1E1E1E]'>{record.studentName}</td>
                                    <td className='px-2 py-4'>{record.className}</td>
                                    <td className='px-2 py-4'>{record.section || '—'}</td>
                                    <td className='px-2 py-4'>{record.time || '—'}</td>
                                    <td className='px-2 py-4'>
                                        {canEdit ? (
                                            <select
                                                value={record.attendanceStatus || ''}
                                                onChange={(e) => updateRowStatus(record.studentId, e.target.value)}
                                                className='text-sm border border-[#D9D9D9] rounded-md px-2 py-1.5 bg-white'
                                            >
                                                <option value=''>Unset</option>
                                                {ATTENDANCE_STATUSES.map((status) => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        ) : record.attendanceStatus ? (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusBadgeColor[record.attendanceStatus] || ''}`}>
                                                {record.attendanceStatus}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className='px-2 py-4 rounded-e-lg'>
                                        {!record.inOutStatus || record.inOutStatus === '—' ? (
                                            '—'
                                        ) : (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${inOutStatusBadgeColor[record.inOutStatus] || ''}`}>
                                                {record.inOutStatus}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>
                    {displayRows.length === 0
                        ? 'Showing 0 entries'
                        : `Showing 1 to ${displayRows.length} of ${displayRows.length} entries`}
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

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default ClassAttendance
