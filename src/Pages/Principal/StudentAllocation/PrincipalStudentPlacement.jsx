import React from 'react'
import PendingPlacementList from '../../Coordinator/StudentPlacement/PendingPlacementList'
import PlaceStudent from '../../Coordinator/StudentPlacement/PlaceStudent'
import PromoteStudents from '../../Coordinator/StudentPlacement/PromoteStudents'

const BASE = '/principal/student-allocation-approval'

export const PrincipalPendingPlacement = () => (
    <PendingPlacementList
        basePath={BASE}
        title='Student section assignment'
        subtitle='Principal override: assign any enrolled student to a section. Roll number is automatic.'
    />
)

export const PrincipalPlaceStudent = () => <PlaceStudent basePath={BASE} />

export const PrincipalPromoteStudents = () => <PromoteStudents basePath={BASE} />
