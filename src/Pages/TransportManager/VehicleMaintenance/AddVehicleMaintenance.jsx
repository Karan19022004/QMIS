import React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import VehicleMaintenanceForm from './Components/VehicleMaintenanceForm'
import { getMaintenanceRecords, hydrateMaintenanceRecordsFromApi, saveMaintenanceRecords } from './vehicleMaintenanceData'

const read = (id) => String(document.getElementById(id)?.value ?? '').trim()

const AddVehicleMaintenance = () => {
    const navigate = useNavigate()

    const save = async () => {
        const vehicleNumber = read('vehicle-number')
        const serviceType = read('service-type')
        if (!vehicleNumber || !serviceType) {
            toast.error('Vehicle and service type are required.')
            return
        }
        await hydrateMaintenanceRecordsFromApi()
        const id = `SRV-${Date.now()}`
        const existing = getMaintenanceRecords()
        const saved = await saveMaintenanceRecords([{
            id,
            serviceId: id,
            vehicleNumber,
            vehicleType: read('vehicle-type'),
            serviceType,
            serviceCenter: read('service-center'),
            estimatedCost: read('estimated-cost'),
            status: read('status') || 'Scheduled',
        }, ...existing])
        if (!saved) {
            toast.error('The maintenance record could not be saved.')
            return
        }
        toast.success('Maintenance record saved.')
        navigate('/transport-manager/vehicle-maintenance')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Vehicle Maintenance Information</h2>
                <VehicleMaintenanceForm />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/vehicle-maintenance')}
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

export default AddVehicleMaintenance
