import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { toast } from 'react-toastify'
import { Calendar, ChevronLeft, ChevronRight, Download, Eye, Plus, EllipsisIcon } from 'lucide-react'
import DeleteRequestModal from '../../../Common/CommonComponents/DeleteRequestModal'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import TimeTableModal from './Components/TimeTableModal'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import DenyTimetableModal from '../../Director/Components/DenyTimetableModal'
import {
    CREATE_ROUTE,
    approvalStatusColor,
    decideExamTimetableApproval,
    examStatusColor,
    getClassSectionLabel,
    getExamTimetableRoutes,
    getExamTimetables,
    mapExamApiToTimetableRecord,
} from './examinationTimetableData'
import { canUseExamsApi, listExamsApi } from '../../../services/examsApi'
import { decideApprovalApi } from '../../../services/approvalsApi'

const ExaminationTimetableList = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { editPath, reviewer } = getExamTimetableRoutes(location.pathname)
    const api = canUseExamsApi()
    const [records, setRecords] = useState(() => (api ? [] : getExamTimetables()))
    const [loadError, setLoadError] = useState('')
    const [loading, setLoading] = useState(api)
    const [fromDate, setFromDate] = useState(new Date())
    const [toDate, setToDate] = useState(new Date())
    const [deleteRequestModal, setDeleteRequestModal] = useState(false)
    const [exportModal, setExportModal] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState(null)
    const [denyEntry, setDenyEntry] = useState(null)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const reload = () => {
        if (!api) {
            setRecords(getExamTimetables())
            setLoading(false)
            setLoadError('')
            return
        }
        setLoading(true)
        listExamsApi()
            .then((rows) => {
                setRecords(rows.map(mapExamApiToTimetableRecord))
                setLoadError('')
            })
            .catch((err) => {
                setRecords([])
                setLoadError(err?.message || 'Could not load campus exams.')
            })
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, location.key])

    const filteredRecords = useMemo(() => {
        const query = search.trim().toLowerCase()
        return records.filter((record) => {
            if (statusFilter && record.status !== statusFilter) return false
            if (!query) return true
            const haystack = `${record.id} ${record.examName} ${record.academicYear || ''} ${getClassSectionLabel(record)}`.toLowerCase()
            return haystack.includes(query)
        })
    }, [records, search, statusFilter])

    const applyLocalDecision = (record, approved, reason = '') => {
        const decided = decideExamTimetableApproval(
            record.id,
            approved ? 'Approved' : 'Denied',
            reviewer,
            reason,
            record,
        )
        setRecords((prev) => {
            const nextStatus = approved ? 'Approved' : 'Denied'
            const patched = prev.map((item) => (
                String(item.id) === String(record.id)
                    ? {
                        ...item,
                        ...decided,
                        approvalStatus: nextStatus,
                        status: approved ? 'Published' : item.status,
                        rejectionReason: approved ? '' : reason,
                    }
                    : item
            ))
            // If the row only lived in API list and wasn't present, still refresh from merge.
            if (!patched.some((item) => String(item.id) === String(record.id)) && decided) {
                return [decided, ...patched]
            }
            return patched
        })
        return decided
    }

    const reviewTimetable = async (record, approved, reason = '') => {
        if (!record) return
        let apiOk = false
        if (api && record.approvalId) {
            try {
                await decideApprovalApi(record.approvalId, {
                    decision: approved ? 'approve' : 'deny',
                    comment: approved ? undefined : reason,
                })
                apiOk = true
            } catch (error) {
                const message = String(error?.message || error?.detail?.message || '')
                // Edit can leave UI Pending while campus is already approved — treat as OK.
                if (approved && /already approved/i.test(message)) {
                    apiOk = true
                } else {
                    console.warn('Campus approval decide failed; applying local decision.', error)
                }
            }
        }
        applyLocalDecision(record, approved, reason)
        toast.success(
            approved
                ? (apiOk ? 'Exam timetable approved.' : 'Exam timetable approved (saved locally).')
                : (apiOk ? 'Exam timetable denied.' : 'Exam timetable denied (saved locally).'),
        )
        if (api) reload()
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
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
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status' className='text-base font-medium text-[#808080]'>Status</label>
                        <select
                            id='status'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            <option value='Published'>Published</option>
                            <option value='Draft'>Draft</option>
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
                        <h2 className='text-xl font-medium text-black'>Examination Timetable List</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            Principal or Director can approve, deny, or edit. Edits return the timetable to Pending.
                        </p>
                        {loading && <p className='text-sm text-[#667085] mt-1'>Loading exams…</p>}
                        {loadError && <p className='text-sm text-[#B42318] mt-1'>{loadError}</p>}
                    </div>
                    <div className='flex gap-x-2'>
                        <NavLink
                            to={CREATE_ROUTE}
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
                            <tr className='rounded-lg'>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Exam ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Exam Name</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Academic Year</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Timelines</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Start Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>End Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Approval Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>View Timetable</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className='px-2 py-8 text-center text-[#667085]'>
                                        No examination timetables found.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => (
                                    <tr key={record.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'>
                                        <td className='px-2 py-4 rounded-s-lg'>{record.id}</td>
                                        <td className='px-2 py-4'>{record.examName}</td>
                                        <td className='px-2 py-4'>{record.academicYear || '—'}</td>
                                        <td className='px-2 py-4'>{getClassSectionLabel(record)}</td>
                                        <td className='px-2 py-4'>{record.timelines?.length ?? 0}</td>
                                        <td className='px-2 py-4'>{record.startDate}</td>
                                        <td className='px-2 py-4'>{record.endDate}</td>
                                        <td className='px-2 py-4'>
                                            <span className={`text-sm font-medium border rounded-md px-2 py-1 ${examStatusColor[record.status]}`}>
                                                {record.status}
                                            </span>
                                        </td>
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
                                            {record.approvalStatus === 'Pending' ? (
                                                <div className='flex flex-wrap gap-2'>
                                                    <button
                                                        type='button'
                                                        onClick={() => reviewTimetable(record, true)}
                                                        className='text-sm text-[#4CAF50] border border-[#4CAF5033] bg-[#4CAF5014] rounded-md px-2 py-1 cursor-pointer'
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => setDenyEntry(record)}
                                                        className='text-sm text-[#980E0F] border border-[#980E0F33] bg-[#980E0F14] rounded-md px-2 py-1 cursor-pointer'
                                                    >
                                                        Deny
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => navigate(editPath(record.id))}
                                                        className='text-sm text-[#515DEF] border border-[#515DEF33] bg-[#515DEF14] rounded-md px-2 py-1 cursor-pointer'
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            ) : (
                                                <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                                    <button
                                                        type='button'
                                                        onClick={() => setSelectedRecord(record)}
                                                        className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => navigate(editPath(record.id))}
                                                        className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => setDeleteRequestModal(true)}
                                                        className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                    >
                                                        Delete
                                                    </button>
                                                </Dropdown>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>Showing {filteredRecords.length} entries</p>
                <div className='flex justify-center gap-x-2 flex-wrap'>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'>
                        <ChevronLeft size={16} />
                    </button>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#EDEDF5] text-[#515DEF] hover:bg-[#515DEF] hover:text-white border border-[#E2E8F0] rounded-full cursor-pointer'>
                        1
                    </button>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <DeleteRequestModal deleteRequestModal={deleteRequestModal} setDeleteRequestModal={setDeleteRequestModal} />
            <DenyTimetableModal
                open={Boolean(denyEntry)}
                onClose={() => setDenyEntry(null)}
                onConfirm={(reason) => {
                    reviewTimetable(denyEntry, false, reason)
                    setDenyEntry(null)
                }}
                title={denyEntry ? `Deny ${denyEntry.examName}` : 'Deny timetable'}
            />
            <ExportModal
                exportModal={exportModal}
                setExportModal={setExportModal}
                filename='examination-timetable'
                rows={filteredRecords.map((r) => ({
                    examName: r.examName || r.title,
                    className: r.className,
                    subject: r.subject,
                    examDate: r.examDate || r.date,
                    status: r.status,
                }))}
                exportDescription={<>You are exporting {filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}.</>}
            />
            <TimeTableModal
                open={Boolean(selectedRecord)}
                onClose={() => setSelectedRecord(null)}
                record={selectedRecord}
            />
        </section>
    )
}

export default ExaminationTimetableList
