import React from 'react'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import PlacementAwaitingNotice, { isStudentPlaced } from '../Class/Components/PlacementAwaitingNotice'

const ViewRatings = () => {
    const { activeStudent } = useActiveStudent()
    const placed = isStudentPlaced(activeStudent)

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-6'>
                <h2 className='text-xl font-semibold text-black mb-2'>Star Ratings</h2>
                <p className='text-sm text-[#667085] mb-4'>
                    {activeStudent?.name
                        ? `${activeStudent.name} · ${activeStudent.className || ''}${activeStudent.section ? `-${activeStudent.section}` : ''}`
                        : 'Student'}
                    {activeStudent?.rollNumber ? ` · Roll ${activeStudent.rollNumber}` : ''}
                </p>
                {!placed ? (
                    <PlacementAwaitingNotice
                        studentName={activeStudent?.name}
                        featureLabel='star ratings'
                    />
                ) : (
                    <div className='py-10 text-center text-sm text-[#667085] space-y-2'>
                        <p>No star ratings have been published for this student yet.</p>
                        <p className='text-xs'>
                            When teachers or coordinators publish Star of the Month / Year for your class,
                            results will appear here. Demo ratings are no longer shown.
                        </p>
                    </div>
                )}
            </div>
        </section>
    )
}

export default ViewRatings
