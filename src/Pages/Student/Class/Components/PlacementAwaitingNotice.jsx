import React from 'react'

/** Shown when the student has no section/roll yet (coordinator has not placed them). */
const PlacementAwaitingNotice = ({ studentName = '', featureLabel = 'this information' }) => (
    <div className='py-10 text-center text-sm text-[#667085] space-y-2 px-4'>
        <p className='text-base font-medium text-[#0C1E5B]'>Awaiting section assignment</p>
        <p>
            {studentName ? `${studentName} has` : 'This student has'} been enrolled, but a class
            section and roll number have not been assigned yet.
        </p>
        <p className='text-xs'>
            The grade coordinator assigns the section (roll number is automatic). After that,{' '}
            {featureLabel} will appear here — including class teacher, attendance, and timetable.
        </p>
    </div>
)

export const isStudentPlaced = (student) =>
    String(student?.placementStatus || '').toLowerCase() === 'placed'
    && Boolean(student?.section)

export default PlacementAwaitingNotice
