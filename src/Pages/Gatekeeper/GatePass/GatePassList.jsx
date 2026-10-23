import React, { useEffect, useState } from 'react'
import { listFrontOfficeRecordsApi } from '../../../services/frontOfficeApi'
import { NavLink } from 'react-router-dom';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import mo_user from "../../../assets/images/no-profile.png"
import ExportModal from '../../../Common/CommonComponents/ExportModal';
import EditRequestModal from '../../../Common/CommonComponents/EditRequestModal';
import DeleteRequestModal from '../../../Common/CommonComponents/DeleteRequestModal';

const GatePassList = () => {

    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [exportModal, setExportModal] = useState(false);
    const [editRequestModal, setEditRequestModal] = useState(false);
    const [deleteRequestModal, setDeleteRequestModal] = useState(false);
    const [passes, setPasses] = useState([]);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        let active = true
        Promise.all([
            listFrontOfficeRecordsApi('student-gate-passes'),
            listFrontOfficeRecordsApi('hostel-gate-passes'),
            listFrontOfficeRecordsApi('material-gate-passes'),
        ]).then(([students, hostel, material]) => {
            if (!active) return
            const withType = (rows, passType) => (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, passType }))
            setPasses([
                ...withType(students, 'Student'),
                ...withType(hostel, 'Hostel'),
                ...withType(material, 'Material'),
            ])
            setLoadError('')
        }).catch(() => {
            if (!active) return
            setPasses([])
            setLoadError('Gate passes could not be loaded.')
        })
        return () => { active = false }
    }, [])

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'>Clear Filters</button>
                    <select name="" id="" className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-xs sm:max-w-full'>
                        <option value="">From Beginning</option>
                    </select>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor="search" className='text-base font-medium text-[#808080]'>Search</label>
                        <input type="text" className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor="status" className='text-base font-medium text-[#808080]'>Status</label>
                        <select name="" id="" className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'>
                            <option value="">All</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>

                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable={true}
                                showMonthYearDropdown={true}
                                scrollableMonthYearDropdown={true}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />

                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>

                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>

                        <div className='relative'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable={true}
                                showMonthYearDropdown={true}
                                scrollableMonthYearDropdown={true}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />

                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>
                </div>
            </div>


            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <h2 className='text-xl font-medium text-black'>Gate Pass List</h2>
                    <div className='flex gap-x-2'>
                        <NavLink to="/gate-keeper/add-gate-pass" className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'>
                            <Plus size={16} />
                            Add Gate Pass
                        </NavLink>
                        <button onClick={() => setExportModal(true)} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'>
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>
                <div className='flex gap-x-2 items-center my-2'>
                    <select name="" id="" className='px-2 py-1.5 bg-white text-[#515DEF] border border-[#515DEF] rounded-md'>
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                    </select>
                    <span className='text-sm font-normal text-[#515DEF]'>Entries Per Page</span>
                </div>
                <div className="relative overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg">
                            <tr className='rounded-lg'>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase text-center rounded-s-lg">Profile</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Gate Pass ID</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Pass Type</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Name</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Mobile Number</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Purpose of Visit</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">In Time</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Out Time</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Approved By</th>
                                <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {passes.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-2 py-6 text-center text-[#667085]">
                                        {loadError || 'No gate passes have been issued.'}
                                    </td>
                                </tr>
                            )}
                            {passes.map((pass) => (
                                <tr key={pass.id} className="border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg">
                                    <td className="px-2 py-4 object-cover flex justify-center rounded-s-lg">
                                        <img src={mo_user} alt="" className='w-10 h-10 object-cover' />
                                    </td>
                                    <td className="px-2 py-4">{pass.gatePassId || pass.id}</td>
                                    <td className="px-2 py-4">{pass.passType}</td>
                                    <td className="px-2 py-4">{pass.studentName || pass.name || pass.visitorName || '—'}</td>
                                    <td className="px-2 py-4">{pass.mobileNumber || pass.mobile || pass.phone || '—'}</td>
                                    <td className="px-2 py-4">{pass.purpose || pass.reason || pass.leaveType || '—'}</td>
                                    <td className="px-2 py-4">{pass.inTime || pass.outTime || '—'}</td>
                                    <td className="px-2 py-4">{pass.outTime && pass.inTime ? pass.outTime : (pass.returnTime || '—')}</td>
                                    <td className="px-2 py-4">{pass.approvedBy || pass.status || '—'}</td>
                                    <td className="px-2 py-4 text-center rounded-e-lg">{pass.status || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>Showing {passes.length === 0 ? 0 : 1} to {passes.length} of {passes.length} entries</p>

                <div className="flex justify-center gap-x-2 flex-wrap">
                    <button className="size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer">
                        <ChevronLeft size={16} />
                    </button>

                    <button className="size-8 flex justify-center items-center p-2 bg-[#EDEDF5] text-[#515DEF] hover:bg-[#515DEF] hover:text-white border border-[#E2E8F0] rounded-full cursor-pointer">
                        1
                    </button>

                    <button className="size-8 flex justify-center items-center p-2 bg-[#EDEDF5] text-[#515DEF] hover:bg-[#515DEF] hover:text-white border border-[#E2E8F0] rounded-full cursor-pointer">
                        2
                    </button>

                    <button className="size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />

            <EditRequestModal editRequestModal={editRequestModal} setEditRequestModal={setEditRequestModal} />

            <DeleteRequestModal deleteRequestModal={deleteRequestModal} setDeleteRequestModal={setDeleteRequestModal} />

        </section>
    )
}

export default GatePassList
