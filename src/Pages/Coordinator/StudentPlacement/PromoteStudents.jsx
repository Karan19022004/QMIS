import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    getPromoteOptionsApi,
    listPlacedStudentsApi,
    promoteStudentApi,
} from '../../../services/placementApi'

const PromoteStudents = ({ basePath = '/coordinator/student-placement' }) => {
    const [rows, setRows] = useState([])
    const [selectedId, setSelectedId] = useState('')
    const [promoteOpts, setPromoteOpts] = useState(null)
    const [targetSectionId, setTargetSectionId] = useState('')
    const [loading, setLoading] = useState(true)
    const [loadingOpts, setLoadingOpts] = useState(false)
    const [saving, setSaving] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const placed = await listPlacedStudentsApi()
            setRows(placed)
        } catch (err) {
            toast.error(err.message || 'Failed to load students.')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    useEffect(() => {
        if (!selectedId) {
            setPromoteOpts(null)
            setTargetSectionId('')
            return undefined
        }
        let cancelled = false
        setLoadingOpts(true)
        setTargetSectionId('')
        getPromoteOptionsApi(selectedId)
            .then((opts) => {
                if (!cancelled) setPromoteOpts(opts)
            })
            .catch((err) => {
                if (!cancelled) {
                    setPromoteOpts(null)
                    toast.error(err.message || 'Could not load next-grade options.')
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingOpts(false)
            })
        return () => {
            cancelled = true
        }
    }, [selectedId])

    const sections = (promoteOpts?.sections || []).filter((s) => s.isActive !== false)
    const canPromote = Boolean(
        selectedId
        && promoteOpts?.classId
        && promoteOpts?.nextGrade
        && targetSectionId,
    )

    const handlePromote = async () => {
        if (!canPromote) {
            toast.error('Select a student and a section in the next grade.')
            return
        }
        setSaving(true)
        try {
            const updated = await promoteStudentApi(selectedId, {
                targetClassId: promoteOpts.classId,
                targetSectionId,
                academicYearId: promoteOpts.academicYearId,
            })
            toast.success(
                `Promoted to ${updated.className}-${updated.section}. New roll: ${updated.rollNumber}`,
            )
            setSelectedId('')
            setPromoteOpts(null)
            setTargetSectionId('')
            await refresh()
        } catch (err) {
            toast.error(err.message || 'Promotion failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className='bg-white rounded-2xl shadow-md p-6'>
            <div className='flex flex-wrap items-start justify-between gap-4 mb-4'>
                <div>
                    <h2 className='text-xl font-semibold text-[#0C1E5B]'>Promote students</h2>
                    <p className='text-sm text-[#667085] mt-1'>
                        Students move to the next grade only (e.g. Grade 1 → Grade 2). Choose the
                        section in that next grade; roll number is assigned automatically. After a
                        band handoff (e.g. 4 → 5), the next coordinator takes over.
                    </p>
                </div>
                <Link to={basePath} className='text-sm text-[#515DEF] hover:underline'>
                    Back to pending placement
                </Link>
            </div>

            {loading ? (
                <p className='text-sm text-[#667085]'>Loading…</p>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl'>
                    <div>
                        <label className='text-base font-medium' htmlFor='studentId'>
                            Student (placed in your band)
                        </label>
                        <select
                            id='studentId'
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className='mt-2 text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        >
                            <option value=''>Select student</option>
                            {rows.map((row) => (
                                <option key={row.id} value={row.id}>
                                    {row.name} — {row.className}
                                    {row.section ? `-${row.section}` : ''}
                                    {row.rollNumber !== '' && row.rollNumber != null
                                        ? ` #${row.rollNumber}`
                                        : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className='text-base font-medium' htmlFor='targetClass'>
                            Target class (next grade only)
                        </label>
                        <input
                            id='targetClass'
                            type='text'
                            readOnly
                            value={
                                loadingOpts
                                    ? 'Loading…'
                                    : promoteOpts?.message
                                        ? promoteOpts.message
                                        : promoteOpts?.className
                                            || (selectedId ? 'Select a student' : '—')
                            }
                            className='mt-2 text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-[#F5F5F5]'
                        />
                        {promoteOpts?.currentGrade != null && promoteOpts?.nextGrade != null && (
                            <p className='text-sm text-[#515DEF] mt-2'>
                                Grade {promoteOpts.currentGrade} → Grade {promoteOpts.nextGrade}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className='text-base font-medium' htmlFor='targetSectionId'>
                            Target section
                        </label>
                        <select
                            id='targetSectionId'
                            value={targetSectionId}
                            onChange={(e) => setTargetSectionId(e.target.value)}
                            disabled={!sections.length}
                            className='mt-2 text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full disabled:bg-[#F5F5F5]'
                        >
                            <option value=''>Select section</option>
                            {sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                    {section.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <button
                type='button'
                disabled={saving || !canPromote}
                onClick={handlePromote}
                className='mt-8 px-6 py-2 rounded-md bg-[#515DEF] text-white disabled:opacity-50'
            >
                {saving ? 'Promoting…' : 'Confirm promotion'}
            </button>
        </section>
    )
}

export default PromoteStudents
