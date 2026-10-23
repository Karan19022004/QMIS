import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getLibraryBooks, hydrateLibraryFromApi, issueLibraryBook } from '../libraryData'

const inputClass = 'text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 w-full'

const AddIssueBook = () => {
    const navigate = useNavigate()
    const [books, setBooks] = useState([])
    const [bookId, setBookId] = useState('')
    const [memberName, setMemberName] = useState('')
    const [issueDate, setIssueDate] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        hydrateLibraryFromApi().finally(() => setBooks(getLibraryBooks().filter((row) => Number(row.available) > 0)))
    }, [])

    const save = async () => {
        setSaving(true)
        setError('')
        try {
            await hydrateLibraryFromApi()
            const result = issueLibraryBook({ bookId, memberName, issueDate, dueDate })
            if (!result.success) {
                setError(result.message)
                return
            }
            toast.success('Book issued.')
            navigate('/librarian/issued-books/issued-book-list')
        } catch (err) {
            setError(err?.message || 'The issue could not be saved.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className='space-y-4'>
            <div className='bg-white rounded-2xl shadow-md p-6 space-y-4'>
                <h2 className='text-xl font-semibold text-black'>Issue book</h2>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <label className='text-sm text-[#344054]'>Book
                        <select className={inputClass} value={bookId} onChange={(event) => setBookId(event.target.value)}>
                            <option value=''>Select an available book</option>
                            {books.map((book) => (
                                <option key={book.id} value={book.id}>{book.title} ({book.available} available)</option>
                            ))}
                        </select>
                    </label>
                    <label className='text-sm text-[#344054]'>Member name
                        <input className={inputClass} value={memberName} onChange={(event) => setMemberName(event.target.value)} />
                    </label>
                    <label className='text-sm text-[#344054]'>Issue date
                        <input type='date' className={inputClass} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                    </label>
                    <label className='text-sm text-[#344054]'>Due date
                        <input type='date' className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                    </label>
                </div>
                {books.length === 0 && <p className='text-sm text-[#667085]'>No available copies. Add a book first.</p>}
                {error && <p className='text-sm text-red-600' role='alert'>{error}</p>}
            </div>
            <div className='flex justify-end gap-3'>
                <button type='button' onClick={() => navigate('/librarian/issued-books/issued-book-list')} className='border border-[#515DEF] text-[#515DEF] px-6 py-2 rounded-md cursor-pointer'>Discard</button>
                <button type='button' disabled={saving} onClick={save} className='bg-[#515DEF] text-white px-6 py-2 rounded-md cursor-pointer disabled:opacity-60'>{saving ? 'Saving…' : 'Save issue'}</button>
            </div>
        </section>
    )
}

export default AddIssueBook
