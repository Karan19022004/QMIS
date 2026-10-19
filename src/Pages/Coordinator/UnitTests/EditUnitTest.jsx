import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import UnitTestForm from './Components/UnitTestForm'
import {
    getUnitTestById,
    hydrateUnitTestsFromApi,
    ROUTE_BASE,
    updateUnitTest,
} from './unitTestsData'

const EditUnitTest = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [record, setRecord] = useState(() => getUnitTestById(id))
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        hydrateUnitTestsFromApi().finally(() => {
            if (cancelled) return
            setRecord(getUnitTestById(id))
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [id])

    const handleSave = async (values) => {
        await updateUnitTest(id, values)
        navigate(ROUTE_BASE)
    }

    if (loading) {
        return (
            <section>
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    Loading unit test…
                </div>
            </section>
        )
    }

    if (!record) {
        return (
            <section>
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    Unit test record not found or could not be loaded.
                </div>
            </section>
        )
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Edit Unit Test</h2>
                <p className='text-sm text-[#667085] mt-1'>{record.entryId}</p>
                <div className='mt-4'>
                    <UnitTestForm formId='unit-test-form' record={record} onSubmit={handleSave} />
                </div>
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate(ROUTE_BASE)}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='submit'
                    form='unit-test-form'
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Save Changes
                </button>
            </div>
        </section>
    )
}

export default EditUnitTest
