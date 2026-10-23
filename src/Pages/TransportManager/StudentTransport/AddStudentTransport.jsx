import React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import StudentTransportForm from './Components/StudentTransportForm'
import { getStudentTransports, hydrateStudentTransportsFromApi, saveStudentTransports } from './studentTransportData'

const read = (id) => String(document.getElementById(id)?.value ?? '').trim()

const AddStudentTransport = () => {
    const navigate = useNavigate()

    const save = async () => {
        const studentName = read('student-name')
        if (!studentName) {
            toast.error('Student name is required.')
            return
        }
        await hydrateStudentTransportsFromApi()
        const id = `ST-${Date.now()}`
        const existing = getStudentTransports().filter((row) => row.studentName !== studentName)
        const saved = await saveStudentTransports([{
            id,
            studentId: read('student-id'),
            studentName,
            classSection: read('class-section'),
            admissionNumber: read('admission-number'),
            routeName: read('route-name'),
            vehicleNumber: read('vehicle-number'),
            startLocation: read('start-location'),
            endLocation: read('end-location'),
            pickUpTime: read('pick-up-time'),
            dropTime: read('drop-time'),
            feesStructure: read('fees-structure'),
            supportStaff: read('support-staff'),
            driverName: read('driver-name'),
            driverContact: read('driver-contact'),
        }, ...existing])
        if (!saved) {
            toast.error('The assignment could not be saved.')
            return
        }
        toast.success('Student transport assignment saved.')
        navigate('/transport-manager/student-transport')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Student Transport Information</h2>
                <StudentTransportForm />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/student-transport')}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    onClick={save}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Save Changes
                </button>
            </div>
        </section>
    )
}

export default AddStudentTransport
