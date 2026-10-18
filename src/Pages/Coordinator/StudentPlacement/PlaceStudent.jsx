import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getPlacementOptionsApi, placeStudentApi } from '../../../services/placementApi'
import { getStudentApi } from '../../../services/studentsApi'

const PlaceStudent = ({ basePath = '/coordinator/student-placement' }) => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [student, setStudent] = useState(null)
    const [options, setOptions] = useState(null)
    const [sectionId, setSectionId] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setError('')
            setSectionId('')
            try {
                const profile = await getStudentApi(id)
                if (cancelled) return
                setStudent(profile)
                const placement = await getPlacementOptionsApi(profile.className || '')
                if (cancelled) return
                setOptions(placement)
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load student.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [id])

    const sections = (options?.sections || []).filter((s) => s.isActive !== false)

    const handleSave = async () => {
        if (!sectionId) {
            toast.error('Select a section.')
            return
        }
        setSaving(true)
        try {
            const updated = await placeStudentApi(id, sectionId)
            toast.success(
                `Placed in ${updated.className}-${updated.section}. Roll no: ${updated.rollNumber}`,
            )
            navigate(basePath)
        } catch (err) {
            toast.error(err.message || 'Placement failed.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-6'>
                <p className='text-sm text-[#667085]'>Loading…</p>
            </section>
        )
    }

    if (error || !student) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-6'>
                <p className='text-sm text-[#F44336]'>{error || 'Student not found.'}</p>
                <button
                    type='button'
                    onClick={() => navigate(basePath)}
                    className='mt-4 text-[#515DEF] hover:underline'
                >
                    Back
                </button>
            </section>
        )
    }

    return (
        <section className='bg-white rounded-2xl shadow-md p-6'>
            <h2 className='text-xl font-semibold text-[#0C1E5B]'>Assign section</h2>
            <p className='text-sm text-[#667085] mt-1'>
                Roll number is generated automatically as the next number in the chosen section.
            </p>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6'>
                <div>
                    <p className='text-xs text-[#667085]'>Student</p>
                    <p className='text-base font-medium'>{student.name}</p>
                </div>
                <div>
                    <p className='text-xs text-[#667085]'>Admission No</p>
                    <p className='text-base font-medium'>{student.admissionNumber || '—'}</p>
                </div>
                <div>
                    <p className='text-xs text-[#667085]'>Class</p>
                    <p className='text-base font-medium'>
                        {options?.className || student.className || '—'}
                    </p>
                </div>
            </div>

            <div className='mt-6 max-w-md'>
                <label htmlFor='sectionId' className='text-base font-medium text-[#1E1E1E]'>
                    Section
                </label>
                {sections.length === 0 ? (
                    <p className='text-sm text-[#F44336] mt-2'>
                        No active sections for {options?.className || student.className}. Add sections
                        in Admin Class Details.
                    </p>
                ) : (
                    <select
                        id='sectionId'
                        value={sectionId}
                        onChange={(e) => setSectionId(e.target.value)}
                        className='mt-2 text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                    >
                        <option value=''>Select section</option>
                        {sections.map((section) => (
                            <option key={section.id} value={section.id}>
                                {section.name}
                                {section.capacity != null ? ` (cap ${section.capacity})` : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className='flex gap-3 mt-8'>
                <button
                    type='button'
                    onClick={() => navigate(basePath)}
                    className='px-6 py-2 rounded-md border border-[#515DEF] text-[#515DEF]'
                >
                    Cancel
                </button>
                <button
                    type='button'
                    disabled={saving || !sectionId}
                    onClick={handleSave}
                    className='px-6 py-2 rounded-md bg-[#515DEF] text-white disabled:opacity-50'
                >
                    {saving ? 'Saving…' : 'Confirm placement'}
                </button>
            </div>
        </section>
    )
}

export default PlaceStudent
