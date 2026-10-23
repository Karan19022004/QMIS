import React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import IssueReturnInfo from './Components/IssueReturnInfo'
import { getIssueReturns, hydrateIssueReturnsFromApi, saveIssueReturns } from './issueReturnsData'

const read = (id) => String(document.getElementById(id)?.value ?? '').trim()

const AddIssueReturn = () => {
    const navigate = useNavigate()

    const save = async () => {
        const employeeName = read('employee-name')
        const itemName = read('item-name')
        const quantity = Number(read('quantity') || 0)
        if (!employeeName || !itemName || quantity <= 0) {
            toast.error('Employee, item, and quantity are required.')
            return
        }
        await hydrateIssueReturnsFromApi()
        const id = `IR-${Date.now()}`
        const saved = await saveIssueReturns([{
            id,
            activityType: read('activity-type') || 'Issue',
            requestedBy: employeeName,
            employeeId: read('employee-id'),
            department: read('department'),
            itemName,
            quantity,
            remarks: read('remarks'),
            purpose: read('purpose'),
            status: 'Recorded',
        }, ...getIssueReturns()])
        if (!saved) {
            toast.error('The stock movement could not be saved.')
            return
        }
        toast.success('Stock movement saved.')
        navigate('/stationery-store-manager/issue-returns')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Record Issue / Return</h2>
                <IssueReturnInfo />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button type='button' onClick={() => navigate('/stationery-store-manager/issue-returns')} className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'>
                    Discard Changes
                </button>
                <button type='button' onClick={save} className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full'>
                    Save Changes
                </button>
            </div>
        </section>
    )
}

export default AddIssueReturn
