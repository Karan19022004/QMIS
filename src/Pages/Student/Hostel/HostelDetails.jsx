import React from 'react'

const HostelDetails = () => (
    <section>
        <div className='bg-white rounded-2xl shadow-md p-8 text-center space-y-2'>
            <h2 className='text-xl font-semibold text-black'>Hostel Details</h2>
            <p className='text-sm text-[#667085]'>
                No hostel allocation is linked to this student account yet.
            </p>
            <p className='text-xs text-[#667085]'>
                When hostel records are published for your admission, room and block details will show here.
                Placeholder hostel data has been removed.
            </p>
        </div>
    </section>
)

export default HostelDetails
