import React from 'react'
import RequestProductFromStore from '../../../Common/Store/RequestProductFromStore'

/** Maintenance department product requests → Store Requests & Approvals. */
const StoreRequests = () => (
    <RequestProductFromStore
        department="Maintenance"
        requestedBy="Maintenance Manager"
        title="Request Product from Store"
        description="Request materials from Store for Maintenance repairs. Store Officer reviews and issues stock (JD/Finance for purchases separately)."
    />
)

export default StoreRequests
