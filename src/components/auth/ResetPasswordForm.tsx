'use client';

import { useFormState } from 'react-dom';
import { updatePassword, type FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';

export default function ResetPasswordForm() {
  const [state, action] = useFormState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="password" className="field-label">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
