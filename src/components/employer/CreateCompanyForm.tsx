'use client';

import { useFormState } from 'react-dom';
import { createCompany } from '@/app/employer/actions';
import type { FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';

export default function CreateCompanyForm() {
  const [state, action] = useFormState<FormState, FormData>(createCompany, {});
  return (
    <form action={action} className="card grid gap-5 p-7 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="name" className="field-label">Company name</label>
        <input id="name" name="name" required className="field" />
      </div>
      <div>
        <label htmlFor="industry" className="field-label">Industry</label>
        <input id="industry" name="industry" placeholder="e.g. Defense, Logistics" className="field" />
      </div>
      <div>
        <label htmlFor="headquarters" className="field-label">Headquarters</label>
        <input id="headquarters" name="headquarters" placeholder="City, State" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="website" className="field-label">Website</label>
        <input id="website" name="website" type="url" placeholder="https://" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="about" className="field-label">About the company</label>
        <textarea id="about" name="about" rows={4} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="veteran_commitment" className="field-label">Your commitment to veterans</label>
        <textarea id="veteran_commitment" name="veteran_commitment" rows={2} placeholder="What makes your company a good home for people who served?" className="field" />
      </div>
      <div className="sm:col-span-2">
        <FormMessage error={state.error} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Create company profile</SubmitButton>
      </div>
    </form>
  );
}
