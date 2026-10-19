import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import ExtraClassForm from './Components/ExtraClassForm'
import { addExtraClass } from './extraClassData'

const AddExtraClass = ({ listPath = '/teacher/class/extra-class' }) => {
    const navigate = useNavigate()
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (values) => {
        if (saving) return
        if (!values.subject || !values.className || !values.section || !values.topic || !values.date) {
            setError('Subject, class, section, topic, and date are required.')
            return
        }
        if (!values.startTime || !values.endTime) {
            setError('Start time and end time are required.')
            return
        }
        if (!values.venue) {
            setError('Venue is required.')
            return
        }
        setError('')
        setSaving(true)
        try {
            const record = await addExtraClass(values)
            toast.success(`Extended class ${record.extraClassId} saved.`)
            navigate(listPath, { state: { createdId: record.id, refresh: Date.now() }, replace: true })
        } catch (err) {
            setError(err?.message || 'Could not save extended class.')
            toast.error(err?.message || 'Could not save extended class.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Extended Class Information</h2>
                <p className='text-sm text-[#667085] mt-1'>
                    Saved sessions are stored in the campus academics database (or local browser store when API mode is off).
                </p>
                {error ? <p className='text-sm text-[#B42318] mt-3'>{error}</p> : null}
                <ExtraClassForm formId='extra-class-form' onSubmit={handleSubmit} />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate(listPath)}
                    disabled={saving}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-50'
                >
                    Discard Changes
                </button>
                <button
                    type='submit'
                    form='extra-class-form'
                    disabled={saving}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-50'
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </section>
    )
}

export default AddExtraClass
