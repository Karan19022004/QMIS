import React from 'react'
import { useActiveStudent } from '../../../context/ActiveStudentContext'

const BusRouteDetails = () => {
    const { activeStudent } = useActiveStudent()
    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-8 text-center space-y-2'>
                <h2 className='text-xl font-semibold text-black'>Bus Route Details</h2>
                <p className='text-sm text-[#667085]'>
                    {activeStudent?.name
                        ? `No transport route is assigned for ${activeStudent.name} yet.`
                        : 'No transport route is assigned yet.'}
                </p>
                <p className='text-xs text-[#667085]'>
                    Use Track Bus for live GPS when the school has linked a vehicle.
                    Demo bus-route tables have been removed.
                </p>
            </div>
        </section>
    )
}

export default BusRouteDetails
