import React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import AssignDutyForm from './Components/AssignDutyForm'
import { getDuties, hydrateDutiesFromApi, saveDuties } from './assignDutyData'

const read = (id) => String(document.getElementById(id)?.value ?? '').trim()

const AddAssignDuty = () => {
    const navigate = useNavigate()

    const save = async () => {
        const driverName = read('driver-name')
        const vehicleNumber = read('vehicle-number')
        if (!driverName || !vehicleNumber) {
            toast.error('Driver and vehicle are required.')
            return
        }
        await hydrateDutiesFromApi()
        const id = `DUTY-${Date.now()}`
        const dutyDate = read('duty-date').replaceAll('/', '-')
        const existing = getDuties().filter((row) => row.dutyId !== id)
        const saved = await saveDuties([{
            id,
            dutyId: id,
            driverName,
            driverId: read('driver-id'),
            vehicleNumber,
            routeName: read('route-name'),
            dutyDate,
            shift: read('shift'),
            startTime: read('start-time'),
            endTime: read('end-time'),
            dutyStatus: 'Assigned',
            status: 'Assigned',
        }, ...existing])
        if (!saved) {
            toast.error('The duty could not be saved.')
            return
        }
        toast.success('Duty assigned.')
        navigate('/transport-manager/assign-duty')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Assign Duty Information</h2>
                <AssignDutyForm />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/assign-duty')}
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

export default AddAssignDuty
