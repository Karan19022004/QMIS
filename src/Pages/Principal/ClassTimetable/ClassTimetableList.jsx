import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Eye, Plus, EllipsisIcon } from 'lucide-react'
import { classKeysMatch, normalizeClassKey, normalizeSectionKey } from '../../../Common/Teacher/teacherAssignedClasses'
import DeleteRequestModal from '../../../Common/CommonComponents/DeleteRequestModal'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ClassTimeTableModal from './Components/ClassTimeTableModal'
import {
    CLASS_TIMETABLES_UPDATED_EVENT,
    approvalStatusColor,
    getClassSectionLabel,
    decideClassTimetableApproval,
    decideTimetableChangeRequest,
    getClassTimetables,
    getGradeOptions,
    getSectionOptions,
    getTimetableChangeRequests,
    getTimetableRoutes,
    hydrateClassTimetablesFromApi,
    loadAcademicYearOptions,
} from './classTimetableData'

const PAGE_SIZE = 10
const APPROVAL_STATUSES = ['Pending', 'Approved', 'Denied']

// A timetable belongs to one teacher and can cover several classes, one per period.
const periodsOf = (record) => (
    Array.isArray(record.timelines) && record.timelines.length
        ? record.timelines
        : [{ className: record.className, section: record.section }]
)

const uniqueByClassKey = (labels) => {
    const seen = new Map()
    labels.forEach((label) => {
        const key = normalizeClassKey(label)
        if (key && !seen.has(key)) seen.set(key, label)
    })
    return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

const ClassTimetableList = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { createPath, editPath, canApprove, canEdit, reviewer } = getTimetableRoutes(location.pathname)
    const isCoordinator = location.pathname.startsWith('/coordinator')
    const [records, setRecords] = useState(() => getClassTimetables())
    const [changes, setChanges] = useState(() => getTimetableChangeRequests())
    const [rejectReason, setRejectReason] = useState('')
    const [deleteRequestModal, setDeleteRequestModal] = useState(false)
    const [exportModal, setExportModal] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState(null)
    const [search, setSearch] = useState('')
    const [classFilter, setClassFilter] = useState('')
    const [sectionFilter, setSectionFilter] = useState('')
    const [academicYearFilter, setAcademicYearFilter] = useState('')
    const [academicYearOptions, setAcademicYearOptions] = useState([])
    const [statusFilter, setStatusFilter] = useState('')
    const [teacherFilter, setTeacherFilter] = useState('')
    const [page, setPage] = useState(1)

    const classOptions = useMemo(() => {
        const fromRecords = records.flatMap((item) => periodsOf(item).map((row) => row.className)).filter(Boolean)
        return uniqueByClassKey([...getGradeOptions(), ...fromRecords])
    }, [records])
    const sectionOptions = useMemo(() => {
        const fromRecords = records.flatMap((item) => periodsOf(item).map((row) => normalizeSectionKey(row.section)))
        return [...new Set([...getSectionOptions().map(normalizeSectionKey), ...fromRecords].filter(Boolean))].sort()
    }, [records])
    const teacherOptions = useMemo(() => (
        [...new Set(records.map((item) => String(item.ownerTeacherName || '').trim()).filter(Boolean))].sort()
    ), [records])
    const statusOptions = useMemo(() => (
        [...new Set([...APPROVAL_STATUSES, ...records.map((item) => item.approvalStatus).filter(Boolean)])]
    ), [records])

    const yearFilterOptions = useMemo(() => {
        const fromRecords = records.map((item) => item.academicYear).filter(Boolean)
        const fromMasters = academicYearOptions.map((item) => item.name)
        return [...new Set([...fromMasters, ...fromRecords])].sort((a, b) =>
            b.localeCompare(a, undefined, { numeric: true }),
        )
    }, [records, academicYearOptions])

    const refresh = () => {
        setRecords(getClassTimetables())
        setChanges(getTimetableChangeRequests())
    }

    useEffect(() => {
        hydrateClassTimetablesFromApi().finally(refresh)
        loadAcademicYearOptions()
            .then((rows) => setAcademicYearOptions(Array.isArray(rows) ? rows : []))
            .catch(() => setAcademicYearOptions([]))
        window.addEventListener(CLASS_TIMETABLES_UPDATED_EVENT, refresh)
        return () => window.removeEventListener(CLASS_TIMETABLES_UPDATED_EVENT, refresh)
    }, [location.key])

    const reviewChange = (id, approved) => {
        if (!approved && !rejectReason.trim()) return
        decideTimetableChangeRequest(id, approved, 'Principal', rejectReason.trim())
        setChanges(getTimetableChangeRequests())
        setRecords(getClassTimetables())
        setRejectReason('')
    }

    const reviewTimetable = (id, approved) => {
        if (!canApprove) return
        if (!approved && !rejectReason.trim()) {
            window.alert('Enter a rejection reason above before denying.')
            return
        }
        decideClassTimetableApproval(id, approved ? 'Approved' : 'Denied', reviewer, rejectReason.trim())
        setRecords(getClassTimetables())
        if (!approved) setRejectReason('')
    }

    const filteredRecords = useMemo(() => {
        const query = search.trim().toLowerCase()
        return records.filter((record) => {
            if (academicYearFilter && record.academicYear !== academicYearFilter) return false
            if (statusFilter && record.approvalStatus !== statusFilter) return false
            if (teacherFilter && String(record.ownerTeacherName || '').trim() !== teacherFilter) return false
            if (classFilter || sectionFilter) {
                const hit = periodsOf(record).some((row) => (
                    (!classFilter || classKeysMatch(row.className, classFilter))
                    && (!sectionFilter || normalizeSectionKey(row.section) === sectionFilter)
                ))
                if (!hit) return false
            }
            if (!query) return true
            const haystack = `${record.id} ${getClassSectionLabel(record)} ${record.academicYear} ${record.term} ${record.ownerTeacherName || ''} ${record.createdByRole || ''}`.toLowerCase()
            return haystack.includes(query)
        })
    }, [records, search, academicYearFilter, statusFilter, teacherFilter, classFilter, sectionFilter])

    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
    const currentPage = Math.min(page, pageCount)
    const pageRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    const withPageReset = (setter) => (value) => {
        setter(value)
        setPage(1)
    }
    const hasFilters = Boolean(search || academicYearFilter || statusFilter || teacherFilter || classFilter || sectionFilter)
    const clearFilters = () => {
        setSearch('')
        setAcademicYearFilter('')
        setStatusFilter('')
        setTeacherFilter('')
        setClassFilter('')
        setSectionFilter('')
        setPage(1)
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-end mb-2'>
                    <button
                        type='button'
                        onClick={clearFilters}
                        disabled={!hasFilters}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-1.5 border border-[#515DEF] rounded-lg hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        Clear Filters
                    </button>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            id='search'
                            value={search}
                            placeholder='ID, class, teacher…'
                            onChange={(e) => withPageReset(setSearch)(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='academic-year-filter' className='text-base font-medium text-[#808080]'>Academic Year</label>
                        <select
                            id='academic-year-filter'
                            value={academicYearFilter}
                            onChange={(e) => withPageReset(setAcademicYearFilter)(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {yearFilterOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='class-filter' className='text-base font-medium text-[#808080]'>Class</label>
                        <select
                            id='class-filter'
                            value={classFilter}
                            onChange={(e) => withPageReset(setClassFilter)(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {classOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='section-filter' className='text-base font-medium text-[#808080]'>Section</label>
                        <select
                            id='section-filter'
                            value={sectionFilter}
                            onChange={(e) => withPageReset(setSectionFilter)(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {sectionOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='teacher-filter' className='text-base font-medium text-[#808080]'>Teacher</label>
                        <select
                            id='teacher-filter'
                            value={teacherFilter}
                            onChange={(e) => withPageReset(setTeacherFilter)(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {teacherOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status-filter' className='text-base font-medium text-[#808080]'>Approval Status</label>
                        <select
                            id='status-filter'
                            value={statusFilter}
                            onChange={(e) => withPageReset(setStatusFilter)(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {statusOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {canApprove ? (
            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <h2 className='text-xl font-medium text-black'>Timetable approval</h2>
                <p className='text-sm text-[#667085] mt-1 mb-3'>
                    Use the rejection reason below when denying a pending timetable.
                </p>
                <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder='Rejection reason (required to Deny)' className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full max-w-md mb-3' />
                {/* Hidden for now — re-enable when timetable change requests are implemented.
                <h2 className='text-xl font-medium text-black'>Timetable change requests</h2>
                {changes.length === 0 && <p className='text-sm text-[#667085]'>No change requests yet.</p>}
                <ul className='space-y-2'>
                    {changes.map((item) => (
                        <li key={item.id} className='border border-[#EDEEF5] rounded-md p-3 text-sm flex flex-wrap justify-between gap-2'>
                            <span>{item.requestedByRole} · {item.className} {item.section} · {item.day} · {item.currentSubject} → {item.requestedSubject} · {item.status}</span>
                            {item.status === 'Pending' && (
                                <span className='flex gap-2'>
                                    <button type='button' onClick={() => reviewChange(item.id, true)} className='text-[#515DEF] cursor-pointer'>Approve</button>
                                    <button type='button' onClick={() => reviewChange(item.id, false)} className='text-[#FF5722] cursor-pointer'>Reject</button>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                */}
            </div>
            ) : null}

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Class Timetable List</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            Principal and Coordinator can create. Pending submissions are approved by Principal or Director. Principal and Director can edit (edits return to Pending).
                        </p>
                    </div>
                    <div className='flex gap-x-2'>
                        <NavLink
                            to={createPath}
                            className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                        >
                            <Plus size={16} />
                            Create Timetable
                        </NavLink>
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
                            <tr>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Timetable ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Teacher</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class & Section</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Academic Year</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Timelines</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Submitted Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Approval Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>View Timetable</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className='px-2 py-8 text-center text-[#667085]'>
                                        {records.length && hasFilters
                                            ? 'No class timetables match these filters.'
                                            : 'No class timetables found. Use Create Timetable to add one.'}
                                    </td>
                                </tr>
                            ) : (
                                pageRecords.map((record) => (
                                    <tr key={record.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                        <td className='px-2 py-4 rounded-s-lg'>{record.id}</td>
                                        <td className='px-2 py-4'>{record.ownerTeacherName || '—'}</td>
                                        <td className='px-2 py-4'>{getClassSectionLabel(record)}</td>
                                        <td className='px-2 py-4'>{record.academicYear}</td>
                                        <td className='px-2 py-4'>{record.timelines?.length ?? 0}</td>
                                        <td className='px-2 py-4'>{record.submittedDate}</td>
                                        <td className='px-2 py-4'>
                                            <span className={`text-sm font-medium border rounded-md px-2 py-1 ${approvalStatusColor[record.approvalStatus]}`}>
                                                {record.approvalStatus}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4'>
                                            <button
                                                type='button'
                                                onClick={() => setSelectedRecord(record)}
                                                className='bg-[#515DEF] text-white text-sm px-2 py-1.5 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                                            >
                                                <Eye size={16} />
                                                View Timetable
                                            </button>
                                        </td>
                                        <td className='px-2 py-4 rounded-e-lg'>
                                            <div className='flex items-center gap-2'>
                                                {canApprove && record.approvalStatus === 'Pending' ? (
                                                    <>
                                                        <button
                                                            type='button'
                                                            onClick={() => reviewTimetable(record.id, true)}
                                                            className='text-sm text-[#4CAF50] font-medium cursor-pointer hover:underline'
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type='button'
                                                            onClick={() => reviewTimetable(record.id, false)}
                                                            className='text-sm text-[#FF5722] font-medium cursor-pointer hover:underline'
                                                        >
                                                            Deny
                                                        </button>
                                                    </>
                                                ) : null}
                                                <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                                    <button
                                                        type='button'
                                                        onClick={() => setSelectedRecord(record)}
                                                        className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                    >
                                                        View
                                                    </button>
                                                    {canEdit ? (
                                                        <button
                                                            type='button'
                                                            onClick={() => navigate(editPath(record.id))}
                                                            className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                        >
                                                            Edit
                                                        </button>
                                                    ) : null}
                                                    {!isCoordinator ? (
                                                        <button
                                                            type='button'
                                                            onClick={() => setDeleteRequestModal(true)}
                                                            className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                        >
                                                            Delete
                                                        </button>
                                                    ) : null}
                                                </Dropdown>
                                            </div>
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
                    {filteredRecords.length === 0
                        ? 'Showing 0 entries'
                        : `Showing ${(currentPage - 1) * PAGE_SIZE + 1} to ${Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of ${filteredRecords.length} entries`}
                </p>
                <div className='flex justify-center items-center gap-x-2'>
                    <button
                        type='button'
                        aria-label='Previous page'
                        disabled={currentPage <= 1}
                        onClick={() => setPage(currentPage - 1)}
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className='text-sm text-[#515DEF]'>{currentPage} / {pageCount}</span>
                    <button
                        type='button'
                        aria-label='Next page'
                        disabled={currentPage >= pageCount}
                        onClick={() => setPage(currentPage + 1)}
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <DeleteRequestModal deleteRequestModal={deleteRequestModal} setDeleteRequestModal={setDeleteRequestModal} />
            <ExportModal
                exportModal={exportModal}
                setExportModal={setExportModal}
                filename='class-timetable-list'
                rows={Array.isArray(filteredRecords) ? filteredRecords : []}
                exportDescription={<>You are exporting {Array.isArray(filteredRecords) ? filteredRecords.length : 0} record(s).</>}
            />
            <ClassTimeTableModal
                open={Boolean(selectedRecord)}
                onClose={() => setSelectedRecord(null)}
                record={selectedRecord}
            />
        </section>
    )
}

export default ClassTimetableList
