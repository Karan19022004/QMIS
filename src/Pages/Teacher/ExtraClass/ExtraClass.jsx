import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, EllipsisIcon, Plus, Download } from 'lucide-react'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import DeleteRequestModal from '../../../Common/CommonComponents/DeleteRequestModal'
import { canUseAcademicsApi } from '../../../services/academicsApi'
import {
    deleteExtraClass,
    EXTRA_CLASSES_UPDATED_EVENT,
    getClasses,
    getExtraClasses,
    getSections,
    getSubjects,
    hydrateExtraClassesFromApi,
    isUsingDemoExtraClasses,
} from './extraClassData'

const ExtraClass = ({
    canCreate = false,
    listPath = '/teacher/class/extra-class',
    addPath = '/teacher/class/extra-class/add',
    viewPath = '/teacher/class/extra-class/view',
}) => {
    const location = useLocation()
    const api = canUseAcademicsApi()
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [exportModal, setExportModal] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [search, setSearch] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('')
    const [classFilter, setClassFilter] = useState('')
    const [sectionFilter, setSectionFilter] = useState('')
    const [rows, setRows] = useState(() => getExtraClasses())
    const [loading, setLoading] = useState(api)
    const [usingDemo, setUsingDemo] = useState(() => isUsingDemoExtraClasses())

    const subjects = getSubjects()
    const classes = getClasses()
    const sections = getSections()

    const refresh = () => {
        setRows(getExtraClasses())
        setUsingDemo(isUsingDemoExtraClasses())
    }

    useEffect(() => {
        let cancelled = false
        setLoading(api)
        hydrateExtraClassesFromApi().finally(() => {
            if (cancelled) return
            refresh()
            setLoading(false)
        })
        const onUpdate = () => refresh()
        window.addEventListener(EXTRA_CLASSES_UPDATED_EVENT, onUpdate)
        return () => {
            cancelled = true
            window.removeEventListener(EXTRA_CLASSES_UPDATED_EVENT, onUpdate)
        }
    }, [api, location.key])

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((record) => {
            if (subjectFilter && record.subject !== subjectFilter) return false
            if (classFilter && record.className !== classFilter) return false
            if (sectionFilter && record.section !== sectionFilter) return false
            if (!query) return true
            const haystack = `${record.extraClassId} ${record.subject} ${record.classSection} ${record.topic} ${record.venue} ${record.reason}`.toLowerCase()
            return haystack.includes(query)
        })
    }, [rows, search, subjectFilter, classFilter, sectionFilter])

    const clearFilters = () => {
        setSearch('')
        setSubjectFilter('')
        setClassFilter('')
        setSectionFilter('')
        setFromDate(null)
        setToDate(null)
    }

    const handleDeleteConfirm = () => {
        if (!deleteTarget) return
        deleteExtraClass(deleteTarget.id)
        setDeleteTarget(null)
        refresh()
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
                    <select className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-xs sm:max-w-full'>
                        <option value=''>From Beginning</option>
                    </select>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            id='search'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Extended class ID, topic...'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='subject-filter' className='text-base font-medium text-[#808080]'>Subject</label>
                        <select
                            id='subject-filter'
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {subjects.map((subject) => (
                                <option key={subject} value={subject}>{subject}</option>
                            ))}
                        </select>
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
                            {classes.map((item) => (
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
                            {sections.map((item) => (
                                <option key={item} value={item}>Section {item}</option>
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
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Extended Class List</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            {api
                                ? 'Campus database list — add a session to persist it for Teacher / Principal / Coordinator.'
                                : 'Browser demo store (API off).'}
                        </p>
                    </div>
                    <div className='flex gap-x-2'>
                        {canCreate && (
                            <NavLink
                                to={addPath}
                                className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                            >
                                <Plus size={16} />
                                Add Extended Class
                            </NavLink>
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
                {usingDemo && !api ? (
                    <p className='text-sm text-[#B54708] bg-[#FFFAEB] border border-[#FEDF89] rounded-lg px-3 py-2 mb-4'>
                        Showing sample extended-class rows. Sign in with API enabled, then add real sessions — dummy rows will not appear in API mode.
                    </p>
                ) : null}
                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left rtl:text-right'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr className='rounded-lg'>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Extended Class ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Subject</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class & Section</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Topic</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Start Time</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>End Time</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Venue</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Reason</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className='px-2 py-8 text-center text-[#667085]'>Loading extended classes…</td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className='px-2 py-8 text-center text-[#667085]'>
                                        {api
                                            ? 'No extended classes in the database yet. Use Add Extended Class to create the first one.'
                                            : 'No extended classes found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((record) => (
                                    <tr key={record.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'>
                                        <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{record.extraClassId}</td>
                                        <td className='px-2 py-4 font-medium text-[#1E1E1E]'>{record.subject}</td>
                                        <td className='px-2 py-4'>{record.classSection}</td>
                                        <td className='px-2 py-4 max-w-xs'>{record.topic}</td>
                                        <td className='px-2 py-4'>{record.date}</td>
                                        <td className='px-2 py-4'>{record.startTime}</td>
                                        <td className='px-2 py-4'>{record.endTime}</td>
                                        <td className='px-2 py-4'>{record.venue}</td>
                                        <td className='px-2 py-4 max-w-xs'>{record.reason}</td>
                                        <td className='px-2 py-4 text-center rounded-e-lg'>
                                            <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                                <NavLink
                                                    to={`${viewPath}/${record.id}`}
                                                    className='block w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                >
                                                    View
                                                </NavLink>
                                                {canCreate ? (
                                                    <button
                                                        type='button'
                                                        onClick={() => setDeleteTarget(record)}
                                                        className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                    >
                                                        Delete
                                                    </button>
                                                ) : null}
                                            </Dropdown>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>
                    Showing {filteredRows.length} of {rows.length} entries
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

            <ExportModal
                exportModal={exportModal}
                setExportModal={setExportModal}
                filename='extra-class'
                rows={filteredRows}
                exportDescription={<>You are exporting {filteredRows.length} record(s).</>}
            />
            <DeleteRequestModal
                deleteRequestModal={Boolean(deleteTarget)}
                setDeleteRequestModal={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
                onConfirm={handleDeleteConfirm}
                title='Delete Extended Class?'
                message='This removes the session from the campus list for all roles that can view it.'
                confirmLabel='Delete'
            />
        </section>
    )
}

export default ExtraClass
