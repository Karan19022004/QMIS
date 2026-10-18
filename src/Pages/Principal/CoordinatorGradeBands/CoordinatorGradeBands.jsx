import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
    listCoordinatorGradeBandsApi,
    upsertCoordinatorGradeBandApi,
} from '../../../services/placementApi'

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

const CoordinatorGradeBands = () => {
    const [rows, setRows] = useState([])
    const [drafts, setDrafts] = useState({})
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState('')

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const list = await listCoordinatorGradeBandsApi()
            setRows(list)
            const next = {}
            list.forEach((row) => {
                next[row.userId] = {
                    gradeFrom: row.gradeFrom ?? 1,
                    gradeTo: row.gradeTo ?? 4,
                }
            })
            setDrafts(next)
        } catch (err) {
            toast.error(err.message || 'Failed to load coordinators.')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const updateDraft = (userId, key, value) => {
        setDrafts((prev) => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [key]: Number(value),
            },
        }))
    }

    const handleSave = async (userId) => {
        const draft = drafts[userId]
        if (!draft) return
        if (draft.gradeFrom > draft.gradeTo) {
            toast.error('Grade from cannot be greater than grade to.')
            return
        }
        setSavingId(userId)
        try {
            const saved = await upsertCoordinatorGradeBandApi({
                userId,
                gradeFrom: draft.gradeFrom,
                gradeTo: draft.gradeTo,
            })
            toast.success(
                `${saved.email}: Grades ${saved.gradeFrom}–${saved.gradeTo} assigned.`,
            )
            await refresh()
        } catch (err) {
            toast.error(err.message || 'Save failed.')
        } finally {
            setSavingId('')
        }
    }

    return (
        <section className='bg-white rounded-2xl shadow-md p-6'>
            <div className='mb-6'>
                <h2 className='text-xl font-semibold text-[#0C1E5B]'>Coordinator grade bands</h2>
                <p className='text-sm text-[#667085] mt-1'>
                    HR creates coordinator logins. Here you assign which grades each coordinator
                    handles (section assignment and promotion for those grades only). Example:
                    Grades 1–4, 5–8, 9–12.
                </p>
            </div>

            {loading ? (
                <p className='text-sm text-[#667085]'>Loading…</p>
            ) : rows.length === 0 ? (
                <p className='text-sm text-[#667085]'>
                    No coordinator accounts found. Ask HR to create coordinator logins first.
                </p>
            ) : (
                <div className='overflow-x-auto'>
                    <table className='min-w-full text-sm'>
                        <thead>
                            <tr className='text-left text-[#667085] border-b border-[#E5E7EB]'>
                                <th className='py-3 pr-4 font-medium'>Coordinator email</th>
                                <th className='py-3 pr-4 font-medium'>Status</th>
                                <th className='py-3 pr-4 font-medium'>Grade from</th>
                                <th className='py-3 pr-4 font-medium'>Grade to</th>
                                <th className='py-3 pr-4 font-medium'>Current band</th>
                                <th className='py-3 font-medium'>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const draft = drafts[row.userId] || { gradeFrom: 1, gradeTo: 4 }
                                return (
                                    <tr key={row.userId} className='border-b border-[#F3F4F6]'>
                                        <td className='py-3 pr-4 text-[#1E1E1E]'>{row.email}</td>
                                        <td className='py-3 pr-4'>
                                            {row.isActive ? (
                                                <span className='text-[#4CAF50]'>Active</span>
                                            ) : (
                                                <span className='text-[#F44336]'>Inactive</span>
                                            )}
                                        </td>
                                        <td className='py-3 pr-4'>
                                            <select
                                                value={draft.gradeFrom}
                                                onChange={(e) =>
                                                    updateDraft(row.userId, 'gradeFrom', e.target.value)
                                                }
                                                className='border border-[#D9D9D9] rounded-md px-2 py-2'
                                            >
                                                {GRADE_OPTIONS.map((g) => (
                                                    <option key={g} value={g}>
                                                        {g}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className='py-3 pr-4'>
                                            <select
                                                value={draft.gradeTo}
                                                onChange={(e) =>
                                                    updateDraft(row.userId, 'gradeTo', e.target.value)
                                                }
                                                className='border border-[#D9D9D9] rounded-md px-2 py-2'
                                            >
                                                {GRADE_OPTIONS.map((g) => (
                                                    <option key={g} value={g}>
                                                        {g}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className='py-3 pr-4'>
                                            {row.gradeFrom != null && row.gradeTo != null
                                                ? `Grades ${row.gradeFrom}–${row.gradeTo}`
                                                : 'Not assigned'}
                                        </td>
                                        <td className='py-3'>
                                            <button
                                                type='button'
                                                disabled={savingId === row.userId}
                                                onClick={() => handleSave(row.userId)}
                                                className='text-[#515DEF] hover:underline disabled:opacity-50'
                                            >
                                                {savingId === row.userId ? 'Saving…' : 'Save'}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}

export default CoordinatorGradeBands
