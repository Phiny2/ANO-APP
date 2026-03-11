import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { crops, regions, type CropGuide, type CropIssue } from '../data';
import {
  buildWhatsappLink,
  formatAvailability,
  getAvailabilityTone,
  getSpecialtyLabel,
} from '../lib/agronomists';
import { formatDate } from '../lib/weather';
import {
  getIssueRecommendation,
} from '../lib/economics';
import type {
  CropEnquiryInput,
  CropEnquiryRecord,
  FarmTeamInviteInput,
  FarmTeamInviteRecord,
  FarmTeamMemberRecord,
} from '../lib/app-types';
import type { CropDiagnosisResult } from '../lib/diagnosis';

interface AgronomistMatch {
  id: string;
  fullName: string;
  email: string;
  regionId: string;
  locationDetail?: string;
  whatsappNumber?: string;
  specializationIds: string[];
  availabilityStatus: 'available' | 'busy' | 'field-visit';
  matchReason: string;
}

interface FarmerSupportDashboardProps {
  busy: boolean;
  nativeMobileApp: boolean;
  mobilePlatformLabel: string;
  selectedCrop: CropGuide | null;
  currentIssue: CropIssue | null;
  issueId: string;
  setIssueId: Dispatch<SetStateAction<string>>;
  enquiryNote: string;
  setEnquiryNote: Dispatch<SetStateAction<string>>;
  photoPreview?: string;
  diagnosis: CropDiagnosisResult | null;
  diagnosisBusy: boolean;
  diagnosisError: string;
  agronomistMatches: AgronomistMatch[];
  regionName: string;
  farmerName: string;
  photoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCapturePhoto: () => Promise<void>;
  onRunDiagnosis: () => Promise<void>;
  onSubmitEnquiry: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  teamInviteForm: {
    label: string;
    teamRole: FarmTeamInviteInput['teamRole'];
  };
  setTeamInviteForm: Dispatch<
    SetStateAction<{
      label: string;
      teamRole: FarmTeamInviteInput['teamRole'];
    }>
  >;
  onSaveTeamInvite: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  teamInvites: FarmTeamInviteRecord[];
  teamMembers: FarmTeamMemberRecord[];
  enquiries: CropEnquiryRecord[];
}

function DiagnosisBox({
  cropId,
  issue,
  diagnosis,
  note,
}: {
  cropId: CropEnquiryInput['cropId'];
  issue: CropIssue;
  diagnosis: CropDiagnosisResult | null;
  note: string;
}) {
  const activeIssue = diagnosis?.issue ?? issue;
  const recommendation = getIssueRecommendation(cropId, activeIssue);

  return (
    <div className="issue-response">
      <div className="issue-header">
        <p className="issue-title">{activeIssue.title}</p>
        <span className={`badge ${diagnosis?.source === 'vision' ? 'success' : 'warning'}`}>
          {diagnosis ? `${Math.round(diagnosis.confidence * 100)}%` : 'Guide'}
        </span>
      </div>
      <p><strong>Signs:</strong> {activeIssue.signs}</p>
      <p><strong>Assessment:</strong> {diagnosis?.summary ?? 'Use the selected issue guide as the starting point.'}</p>
      <p><strong>Response:</strong> {recommendation.advice}</p>
      <p>
        <strong>Suggested product:</strong>{' '}
        {recommendation.productName
          ? `${recommendation.productName}${recommendation.productRate ? ` at ${recommendation.productRate}` : ''}`
          : activeIssue.product}
      </p>
      <p className="muted">
        {diagnosis
          ? diagnosis.followUp
          : note
            ? `Farmer note captured: "${note}". Save the enquiry to keep this case on record.`
            : 'Add a short note so the case can later be reviewed by an agronomist or AI service.'}
      </p>
    </div>
  );
}

function FarmerSupportDashboard({
  busy,
  nativeMobileApp,
  mobilePlatformLabel,
  selectedCrop,
  currentIssue,
  issueId,
  setIssueId,
  enquiryNote,
  setEnquiryNote,
  photoPreview,
  diagnosis,
  diagnosisBusy,
  diagnosisError,
  agronomistMatches,
  regionName,
  farmerName,
  photoChange,
  onCapturePhoto,
  onRunDiagnosis,
  onSubmitEnquiry,
  teamInviteForm,
  setTeamInviteForm,
  onSaveTeamInvite,
  teamInvites,
  teamMembers,
  enquiries,
}: FarmerSupportDashboardProps) {
  return (
    <>
      <section className="card board-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Agronomists</p>
            <h2>Matched support list</h2>
          </div>
          <span className="badge accent">{agronomistMatches.length} listed</span>
        </div>
        <div className="service-grid">
          {agronomistMatches.length ? (
            agronomistMatches.slice(0, 6).map((agronomist) => (
              <article className="service-card" key={agronomist.id}>
                <span className={`badge ${getAvailabilityTone(agronomist.availabilityStatus)}`}>
                  {formatAvailability(agronomist.availabilityStatus)}
                </span>
                <strong>{agronomist.fullName}</strong>
                <p>
                  {regions.find((entry) => entry.id === agronomist.regionId)?.name ?? agronomist.regionId}
                  {agronomist.locationDetail ? ` | ${agronomist.locationDetail}` : ''}
                </p>
                <small>{agronomist.matchReason}</small>
                <small>{agronomist.specializationIds.slice(0, 3).map(getSpecialtyLabel).join(' | ')}</small>
                {agronomist.whatsappNumber ? (
                  <a
                    className="inline-link"
                    href={buildWhatsappLink(
                      agronomist.whatsappNumber,
                      `${selectedCrop?.name ?? 'Crop'} support request from ${farmerName} in ${regionName}. Issue: ${currentIssue?.title ?? 'field issue'}.`,
                    )}
                    rel="noreferrer"
                    target="_blank"
                  >
                    WhatsApp {agronomist.whatsappNumber}
                  </a>
                ) : (
                  <small>{agronomist.email}</small>
                )}
              </article>
            ))
          ) : (
            <p className="muted">No agronomists match this crop and region yet.</p>
          )}
        </div>
      </section>

      <section className="card advisory-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Live camera enquiry</p>
            <h2>Detect the issue and store the case</h2>
          </div>
          {selectedCrop ? <span className="badge accent">{selectedCrop.name}</span> : null}
        </div>
        {selectedCrop ? (
          <form className="stack-form" onSubmit={onSubmitEnquiry}>
            {nativeMobileApp ? (
              <button className="secondary-button" type="button" onClick={() => void onCapturePhoto()}>
                Open {mobilePlatformLabel} camera
              </button>
            ) : null}
            <label className="file-label">
              {nativeMobileApp ? 'Upload from phone gallery or files' : 'Capture or upload crop photo'}
              <input accept="image/*" capture="environment" type="file" onChange={photoChange} />
            </label>
            {photoPreview ? <img alt="Crop preview" className="photo-preview" src={photoPreview} /> : null}
            <label>
              Issue type
              <select value={issueId} onChange={(event) => setIssueId(event.target.value)}>
                {selectedCrop.issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Farmer notes
              <textarea
                rows={4}
                value={enquiryNote}
                onChange={(event) => setEnquiryNote(event.target.value)}
                placeholder="Describe yellowing, weeds, chewing damage, lesions or moisture stress."
              />
            </label>
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={diagnosisBusy || (!photoPreview && !enquiryNote)}
                type="button"
                onClick={() => void onRunDiagnosis()}
              >
                {diagnosisBusy ? 'Diagnosing...' : 'Run diagnosis'}
              </button>
              <button className="primary-button" disabled={busy} type="submit">
                Save enquiry
              </button>
            </div>
            {diagnosisError ? <p className="muted">{diagnosisError}</p> : null}
            {currentIssue ? (
              <DiagnosisBox
                cropId={selectedCrop.id}
                diagnosis={diagnosis}
                issue={currentIssue}
                note={enquiryNote}
              />
            ) : null}
          </form>
        ) : (
          <p className="muted">Choose a crop in Setup first so the enquiry can be tied to the right guide.</p>
        )}
      </section>

      <section className="card board-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Farm team</p>
            <h2>Separate worker access</h2>
          </div>
          <span className="badge accent">{teamMembers.length} active</span>
        </div>
        <form className="form-grid compact" onSubmit={onSaveTeamInvite}>
          <label>
            Invite label
            <input
              required
              type="text"
              value={teamInviteForm.label}
              onChange={(event) =>
                setTeamInviteForm((current) => ({ ...current, label: event.target.value }))
              }
              placeholder="e.g. Block A scout"
            />
          </label>
          <label>
            Role
            <select
              value={teamInviteForm.teamRole}
              onChange={(event) =>
                setTeamInviteForm((current) => ({
                  ...current,
                  teamRole: event.target.value as FarmTeamInviteInput['teamRole'],
                }))
              }
            >
              <option value="worker">Worker</option>
              <option value="scout">Scout</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <button className="secondary-button" disabled={busy} type="submit">
            Create invite code
          </button>
        </form>
        <div className="service-grid top-gap">
          {teamInvites.slice(0, 3).map((invite) => (
            <article className="service-card" key={invite.id}>
              <span className={`badge ${invite.isActive ? 'success' : 'neutral'}`}>
                {invite.isActive ? 'active' : 'used'}
              </span>
              <strong>{invite.label}</strong>
              <p>{invite.teamRole}</p>
              <small>{invite.inviteCode}</small>
            </article>
          ))}
          {teamMembers.slice(0, 3).map((member) => (
            <article className="service-card" key={member.id}>
              <span className="badge accent">{member.teamRole}</span>
              <strong>{member.fullName}</strong>
              <p>{member.email}</p>
              <small>Joined {formatDate(member.createdAt.slice(0, 10))}</small>
            </article>
          ))}
        </div>
      </section>

      {enquiries.length ? (
        <section className="card board-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Recent support cases</p>
              <h2>Latest field enquiries</h2>
            </div>
          </div>
          <div className="enquiry-grid">
            {enquiries.slice(0, 4).map((enquiry) => (
              <article className="subcard compact" key={enquiry.id}>
                <strong>{crops.find((crop) => crop.id === enquiry.cropId)?.name}</strong>
                <span className="muted">{formatDate(enquiry.createdAt.slice(0, 10))}</span>
                <p>{enquiry.note}</p>
                <small>{enquiry.syncState === 'pending' ? 'Waiting to sync' : 'Stored'}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export default FarmerSupportDashboard;
