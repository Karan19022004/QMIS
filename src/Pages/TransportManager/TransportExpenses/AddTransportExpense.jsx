import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import FuelExpenseForm from './Components/FuelExpenseForm'
import ServiceExpenseForm from './Components/ServiceExpenseForm'
import OtherExpenseForm from './Components/OtherExpenseForm'
import { getTransportExpenses, hydrateTransportExpensesFromApi, saveTransportExpenses } from './transportExpensesData'

const read = (id) => String(document.getElementById(id)?.value ?? '').trim()

const ADD_CONFIG = {
    fuel: {
        title: 'Fuel Management',
        Form: FuelExpenseForm,
    },
    service: {
        title: 'Service Expense Information',
        Form: ServiceExpenseForm,
    },
    other: {
        title: 'Other Expense Information',
        Form: OtherExpenseForm,
    },
}

const AddTransportExpense = () => {
    const { type } = useParams()
    const navigate = useNavigate()
    const config = ADD_CONFIG[type]
    const FormComponent = config?.Form

    const save = async () => {
        const vehicleNumber = read('vehicle-number')
        const amount = read('amount')
        if (!vehicleNumber || !amount) {
            toast.error('Vehicle and amount are required.')
            return
        }
        await hydrateTransportExpensesFromApi()
        const prefix = type === 'fuel' ? 'FE' : type === 'service' ? 'SE' : 'OE'
        const id = `${prefix}-${Date.now()}`
        const record = type === 'fuel'
            ? { id, expenseId: id, vehicleNumber, driverName: read('driver-name'), fuelStation: read('fuel-station'), amount, paymentMode: read('payment-mode') }
            : type === 'service'
                ? { id, expenseId: id, vehicleNumber, serviceType: read('service-type'), serviceCenter: read('service-center'), amount, invoiceNumber: read('invoice-number'), remarks: read('remarks') }
                : { id, expenseId: id, vehicleNumber, expenseType: read('expense-type'), amount, paidTo: read('paid-to'), description: read('description'), paymentMode: read('payment-mode') }
        const saved = await saveTransportExpenses([record, ...getTransportExpenses()])
        if (!saved) {
            toast.error('The expense could not be saved.')
            return
        }
        toast.success('Expense saved.')
        navigate('/transport-manager/transport-expenses')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                {!config ? (
                    <p className='text-[#667085] text-center py-8'>Invalid expense type.</p>
                ) : (
                    <>
                        <h2 className='text-xl font-semibold text-black'>{config.title}</h2>
                        <FormComponent />
                    </>
                )}
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/transport-expenses')}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                {config && (
                    <button
                        type='button'
                        onClick={save}
                        className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full'
                    >
                        Save Changes
                    </button>
                )}
            </div>
        </section>
    )
}

export default AddTransportExpense
