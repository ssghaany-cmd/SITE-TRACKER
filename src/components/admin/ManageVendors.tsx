// src/components/admin/ManageVendors.tsx
//
// Lets an admin/superadmin maintain a list of external vendors/
// contractors (plumbers, electricians, etc.) that incidents can be
// assigned to, as an alternative to assigning an internal team member.

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import type { Vendor } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ManageVendors() {
  const { profile } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowErrorId, setRowErrorId] = useState<string | null>(null)

  const fetchVendors = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('vendors')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('name', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setVendors([])
    } else {
      setVendors((data ?? []) as Vendor[])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  const resetForm = () => {
    setName('')
    setContactName('')
    setPhone('')
    setEmail('')
    setSpecialty('')
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!profile) return
    if (!name.trim()) {
      setFormError('Please enter the vendor/company name.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('vendors').insert({
      org_id: profile.org_id,
      name: name.trim(),
      contact_name: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      specialty: specialty.trim(),
    })
    setSubmitting(false)

    if (insertError) {
      setFormError(insertError.message)
      return
    }

    resetForm()
    fetchVendors()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setRowError(null)
    setRowErrorId(null)

    const { error: deleteError } = await supabase.from('vendors').delete().eq('id', id)

    setDeletingId(null)

    if (deleteError) {
      setRowError(
        deleteError.code === '23503'
          ? 'Cannot delete — this vendor is assigned to one or more incidents.'
          : deleteError.message
      )
      setRowErrorId(id)
      return
    }

    fetchVendors()
  }

  if (!profile) return null

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add a Vendor</h3>
        <form onSubmit={handleAdd} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="vendor-name" className="block text-sm font-medium text-slate-700">
                Company / Vendor Name
              </label>
              <input
                id="vendor-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Acme Plumbing Co."
              />
            </div>
            <div>
              <label htmlFor="vendor-specialty" className="block text-sm font-medium text-slate-700">
                Specialty
              </label>
              <input
                id="vendor-specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Plumbing"
              />
            </div>
            <div>
              <label htmlFor="vendor-contact" className="block text-sm font-medium text-slate-700">
                Contact Name
              </label>
              <input
                id="vendor-contact"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label htmlFor="vendor-phone" className="block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="vendor-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="vendor-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="vendor-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="contact@acmeplumbing.com"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Adding…' : 'Add Vendor'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Vendors</h3>

        {loading ? (
          <LoadingSpinner label="Loading vendors…" />
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : vendors.length === 0 ? (
          <p className="text-sm text-slate-500">No vendors added yet.</p>
        ) : (
          <div className="space-y-3">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {vendor.name}
                    {vendor.specialty && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        · {vendor.specialty}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {vendor.contact_name}
                    {vendor.phone && ` · ${vendor.phone}`}
                    {vendor.email && ` · ${vendor.email}`}
                  </p>
                  {rowErrorId === vendor.id && rowError && (
                    <p className="mt-1 text-xs text-red-600">{rowError}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(vendor.id)}
                  disabled={deletingId === vendor.id}
                  className="self-start rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === vendor.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
    }
