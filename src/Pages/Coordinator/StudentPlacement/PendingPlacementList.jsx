import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMyGradeBandApi, listPendingPlacementApi } from '../../../services/placementApi'

const PendingPlacementList = ({
    basePath = '/coordinator/student-placement',
    title = 'Section Assignment',
    subtitle = 'Assign enrolled students in your grade band to a section. Roll number is assigned automatically.',
}) => {
    const navigate = useNavigate()
    const [rows, setRows] = useState([])
    const [band, setBand] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const refresh = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [pending, gradeBand] = await Promise.all([
                listPendingPlacementApi(),
                getMyGradeBandApi().catch(() => null),
            ])
            setRows(pending)
            setBand(gradeBand)
        } catch (err) {
            setError(err.message || 'Failed to load pending placements.')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap items-start justify-between gap-4 mb-4'>
                    <div>
                        <h2 className='text-xl font-semibold text-[#0C1E5B]'>{title}</h2>
                        <p className='text-sm text-[#667085] mt-1'>{subtitle}</p>
                        {band && (
                            <p className='text-sm text-[#515DEF] mt-2'>
                                Your grade band: Grade {band.gradeFrom}–{band.gradeTo}
                            </p>
                        )}
                    </div>
                    <div className='flex gap-2'>
                        <Link
                            to={`${basePath}/promote`}
                            className='text-sm px-4 py-2 rounded-md border border-[#515DEF] text-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-colors'
                        >
                            Promote students
                        </Link>
                        <button
                            type='button'
                            onClick={refresh}
                            className='text-sm px-4 py-2 rounded-md bg-[#515DEF] text-white hover:opacity-90'
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {error && <p className='text-sm text-[#F44336] mb-3'>{error}</p>}
                {loading ? (
                    <p className='text-sm text-[#667085]'>Loading…</p>
                ) : rows.length === 0 ? (
                    <p className='text-sm text-[#667085]'>No students awaiting section assignment in your scope.</p>
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='min-w-full text-sm'>
                            <thead>
                                <tr className='text-left text-[#667085] border-b border-[#E5E7EB]'>
                                    <th className='py-3 pr-4 font-medium'>Name</th>
                                    <th className='py-3 pr-4 font-medium'>Admission No</th>
                                    <th className='py-3 pr-4 font-medium'>Class</th>
                                    <th className='py-3 pr-4 font-medium'>Status</th>
                                    <th className='py-3 font-medium'>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className='border-b border-[#F3F4F6]'>
                                        <td className='py-3 pr-4 text-[#1E1E1E]'>{row.name}</td>
                                        <td className='py-3 pr-4'>{row.admissionNumber || '—'}</td>
                                        <td className='py-3 pr-4'>{row.className || '—'}</td>
                                        <td className='py-3 pr-4'>
                                            <span className='inline-flex px-2 py-1 rounded bg-[#FF980033] text-[#FF9800] text-xs'>
                                                Pending
                                            </span>
                                        </td>
                                        <td className='py-3'>
                                            <button
                                                type='button'
                                                onClick={() => navigate(`${basePath}/place/${row.id}`)}
                                                className='text-[#515DEF] hover:underline cursor-pointer'
                                            >
                                                Assign section
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

export default PendingPlacementList
