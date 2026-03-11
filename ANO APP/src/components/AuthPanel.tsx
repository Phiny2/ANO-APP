import { useState, type FormEvent } from 'react';
import { agronomistSpecialties, regions } from '../data';
import type {
  BackendStatus,
  SignInInput,
  SignUpAgronomistInput,
  SignUpFarmerInput,
  SignUpStaffInput,
} from '../lib/app-types';
import type { AppPreferences } from '../lib/preferences';
import { getAppCopy } from '../lib/preferences';

interface AuthPanelProps {
  backend: BackendStatus;
  busy: boolean;
  message: string;
  onSignIn: (input: SignInInput) => Promise<void>;
  onSignUp: (input: SignUpFarmerInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  onSignUpAgronomist: (
    input: SignUpAgronomistInput,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  onSignUpStaff: (input: SignUpStaffInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  preferences: AppPreferences;
}

function AuthPanel({
  backend,
  busy,
  message,
  onSignIn,
  onSignUp,
  onSignUpAgronomist,
  onSignUpStaff,
  preferences,
}: AuthPanelProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signup');
  const [accountType, setAccountType] = useState<'farmer' | 'agronomist' | 'staff'>('farmer');
  const [signInForm, setSignInForm] = useState({
    login: '',
    password: '',
  });
  const [signUpForm, setSignUpForm] = useState({
    fullName: '',
    farmName: '',
    country: 'Zimbabwe' as 'Zimbabwe' | 'Eswatini',
    regionId: 'mash-west',
    email: '',
    password: '',
  });
  const [agronomistForm, setAgronomistForm] = useState({
    fullName: '',
    country: 'Zimbabwe' as 'Zimbabwe' | 'Eswatini',
    regionId: 'mash-west',
    locationDetail: '',
    whatsappNumber: '',
    specializationIds: ['grain-production'],
    availabilityStatus: 'available' as 'available' | 'busy' | 'field-visit',
    email: '',
    password: '',
  });
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    inviteCode: '',
    email: '',
    password: '',
  });
  const [localMessage, setLocalMessage] = useState('');
  const copy = getAppCopy(preferences.language);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalMessage('');
    try {
      await onSignIn(signInForm);
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalMessage('');
    try {
      const result =
        accountType === 'farmer'
          ? await onSignUp(signUpForm)
          : accountType === 'agronomist'
            ? await onSignUpAgronomist(agronomistForm)
            : await onSignUpStaff(staffForm);
      if (result.requiresEmailConfirmation) {
        setLocalMessage('Account created. Check your email, confirm the account, then sign in.');
        setTab('signin');
      }
    } catch (error) {
      setLocalMessage(
        error instanceof Error
          ? error.message
          : `Unable to create the ${accountType} account.`,
      );
    }
  }

  const note = localMessage || message;

  return (
    <section className="card auth-card">
      <div className="section-header">
        <div>
          <p className="section-kicker">Access</p>
          <h2>{copy.authTitle}</h2>
        </div>
        <div className="tab-row small">
          <button
            className={tab === 'signup' ? 'active' : ''}
            type="button"
            onClick={() => setTab('signup')}
          >
            Farmer sign up
          </button>
          <button
            className={tab === 'signin' ? 'active' : ''}
            type="button"
            onClick={() => setTab('signin')}
          >
            Sign in
          </button>
        </div>
      </div>

      <div className="auth-intro">
        <strong>{copy.authIntroStrong}</strong>
        <span>{copy.authIntroText}</span>
      </div>

      {tab === 'signup' ? (
        <form className="form-grid" onSubmit={handleSignUp}>
          <div className="full-span tab-row small">
            <button
              className={accountType === 'farmer' ? 'active' : ''}
              type="button"
              onClick={() => setAccountType('farmer')}
            >
              Farmer account
            </button>
            <button
              className={accountType === 'agronomist' ? 'active' : ''}
              type="button"
              onClick={() => setAccountType('agronomist')}
            >
              Agronomist account
            </button>
            <button
              className={accountType === 'staff' ? 'active' : ''}
              type="button"
              onClick={() => setAccountType('staff')}
            >
              Staff account
            </button>
          </div>
          <label>
            Full name
            <input
              required
              type="text"
              value={
                accountType === 'farmer'
                  ? signUpForm.fullName
                  : accountType === 'agronomist'
                    ? agronomistForm.fullName
                    : staffForm.fullName
              }
              onChange={(event) =>
                accountType === 'farmer'
                  ? setSignUpForm((current) => ({ ...current, fullName: event.target.value }))
                  : accountType === 'agronomist'
                    ? setAgronomistForm((current) => ({ ...current, fullName: event.target.value }))
                    : setStaffForm((current) => ({ ...current, fullName: event.target.value }))
              }
              placeholder="e.g. Tendai Moyo"
            />
          </label>
          {accountType === 'farmer' ? (
            <label>
              Farm name
              <input
                required
                type="text"
                value={signUpForm.farmName}
                onChange={(event) =>
                  setSignUpForm((current) => ({ ...current, farmName: event.target.value }))
                }
                placeholder="e.g. Green Valley Farm"
              />
            </label>
          ) : null}
          {accountType !== 'staff' ? (
            <>
              <label>
                Country
                <select
                  value={accountType === 'farmer' ? signUpForm.country : agronomistForm.country}
                  onChange={(event) =>
                    accountType === 'farmer'
                      ? setSignUpForm((current) => ({
                          ...current,
                          country: event.target.value as 'Zimbabwe' | 'Eswatini',
                          regionId: event.target.value === 'Eswatini' ? 'eswatini-lowveld' : 'mash-west',
                        }))
                      : setAgronomistForm((current) => ({
                          ...current,
                          country: event.target.value as 'Zimbabwe' | 'Eswatini',
                          regionId: event.target.value === 'Eswatini' ? 'eswatini-lowveld' : 'mash-west',
                        }))
                  }
                >
                  <option value="Zimbabwe">Zimbabwe</option>
                  <option value="Eswatini">Eswatini</option>
                </select>
              </label>
              <label>
                Region
                <select
                  value={accountType === 'farmer' ? signUpForm.regionId : agronomistForm.regionId}
                  onChange={(event) =>
                    accountType === 'farmer'
                      ? setSignUpForm((current) => ({ ...current, regionId: event.target.value }))
                      : setAgronomistForm((current) => ({ ...current, regionId: event.target.value }))
                  }
                >
                  {regions
                    .filter((region) =>
                      region.country === (accountType === 'farmer' ? signUpForm.country : agronomistForm.country),
                    )
                    .map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : (
            <label>
              Farm invite code
              <input
                required
                type="text"
                value={staffForm.inviteCode}
                onChange={(event) => setStaffForm((current) => ({ ...current, inviteCode: event.target.value.toUpperCase() }))}
                placeholder="ANO-AB12-CD34"
              />
            </label>
          )}
          {accountType === 'agronomist' ? (
            <>
              <label>
                Service location
                <input
                  required
                  type="text"
                  value={agronomistForm.locationDetail}
                  onChange={(event) =>
                    setAgronomistForm((current) => ({ ...current, locationDetail: event.target.value }))
                  }
                  placeholder="District, corridor, or service base"
                />
              </label>
              <label>
                WhatsApp number
                <input
                  required
                  type="text"
                  value={agronomistForm.whatsappNumber}
                  onChange={(event) =>
                    setAgronomistForm((current) => ({ ...current, whatsappNumber: event.target.value }))
                  }
                  placeholder="+263..."
                />
              </label>
              <label>
                Availability
                <select
                  value={agronomistForm.availabilityStatus}
                  onChange={(event) =>
                    setAgronomistForm((current) => ({
                      ...current,
                      availabilityStatus: event.target.value as typeof current.availabilityStatus,
                    }))
                  }
                >
                  <option value="available">Available</option>
                  <option value="field-visit">On field visit</option>
                  <option value="busy">Busy</option>
                </select>
              </label>
              <div className="full-span">
                <p className="section-kicker">Specialization</p>
                <div className="chip-selector-grid">
                  {agronomistSpecialties.map((specialty) => {
                    const selected = agronomistForm.specializationIds.includes(specialty.id);
                    return (
                      <button
                        className={`chip-selector ${selected ? 'selected' : ''}`}
                        key={specialty.id}
                        type="button"
                        onClick={() =>
                          setAgronomistForm((current) => ({
                            ...current,
                            specializationIds: selected
                              ? current.specializationIds.filter((id) => id !== specialty.id)
                              : [...current.specializationIds, specialty.id],
                          }))
                        }
                      >
                        <strong>{specialty.label}</strong>
                        <span>{specialty.summary}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
          <label>
            Email
            <input
              required
              type="email"
              value={
                accountType === 'farmer'
                  ? signUpForm.email
                  : accountType === 'agronomist'
                    ? agronomistForm.email
                    : staffForm.email
              }
              onChange={(event) =>
                accountType === 'farmer'
                  ? setSignUpForm((current) => ({ ...current, email: event.target.value }))
                  : accountType === 'agronomist'
                    ? setAgronomistForm((current) => ({ ...current, email: event.target.value }))
                    : setStaffForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder={
                accountType === 'farmer'
                  ? 'farmer@example.com'
                  : accountType === 'agronomist'
                    ? 'agronomist@example.com'
                    : 'worker@example.com'
              }
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={
                accountType === 'farmer'
                  ? signUpForm.password
                  : accountType === 'agronomist'
                    ? agronomistForm.password
                    : staffForm.password
              }
              onChange={(event) =>
                accountType === 'farmer'
                  ? setSignUpForm((current) => ({ ...current, password: event.target.value }))
                  : accountType === 'agronomist'
                    ? setAgronomistForm((current) => ({ ...current, password: event.target.value }))
                    : setStaffForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Create a strong password"
            />
          </label>
          <button className="primary-button" disabled={busy} type="submit">
            {busy
              ? 'Creating account...'
              : accountType === 'farmer'
                ? 'Create farmer account'
                : accountType === 'agronomist'
                  ? 'Create agronomist account'
                  : 'Create staff account'}
          </button>
        </form>
      ) : (
        <form className="form-grid signin-grid" onSubmit={handleSignIn}>
          <label>
            {backend.mode === 'online' ? 'Email' : 'Email or demo username'}
            <input
              required
              type="text"
              value={signInForm.login}
              onChange={(event) =>
                setSignInForm((current) => ({ ...current, login: event.target.value }))
              }
              placeholder={backend.mode === 'online' ? 'user@example.com' : 'gmb.manager'}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={signInForm.password}
              onChange={(event) =>
                setSignInForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Enter your password"
            />
          </label>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      )}

      <div className="demo-note">
        {backend.mode === 'demo'
          ? 'Demo sign-in credentials: gmb.manager / harvest2026, timb.officer / leaf2026, cane.admin / cane2026, agri.moyo / soil2026, leaf.ncube / leafcare2026, cane.dlamini / caneguard2026, national.admin / anosuite2026. Staff accounts are created from farmer invite codes in the sign-up form.'
          : 'In live mode, farmers, agronomists, and farm staff can sign up here, while board and admin accounts should still be provisioned in Firebase Auth and Firestore.'}
      </div>

      {note ? <p className="muted">{note}</p> : null}
    </section>
  );
}

export default AuthPanel;
