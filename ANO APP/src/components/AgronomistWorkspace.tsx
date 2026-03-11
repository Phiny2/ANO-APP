import { useEffect, useState, type FormEvent } from 'react';
import { agronomistSpecialties, crops, regions } from '../data';
import type {
  AgronomistWorkspace as AgronomistWorkspaceData,
  BackendStatus,
  UserProfile,
} from '../lib/app-types';
import { formatAvailability } from '../lib/agronomists';
import { getRegionalCases, syncRegionalCaseSeeds, updateAgronomistCase } from '../lib/operations';
import { formatDate } from '../lib/weather';

interface AgronomistWorkspaceProps {
  backend: BackendStatus;
  busy: boolean;
  workspace: AgronomistWorkspaceData;
  statusMessage: string;
  onRefresh: () => Promise<void>;
  onSaveProfile: (profile: UserProfile, updates: Partial<UserProfile>) => Promise<void>;
  onSignOut: () => Promise<void>;
}

function AgronomistWorkspace({
  backend,
  busy,
  workspace,
  statusMessage,
  onRefresh,
  onSaveProfile,
  onSignOut,
}: AgronomistWorkspaceProps) {
  const [profileForm, setProfileForm] = useState({
    fullName: workspace.profile.fullName,
    country: workspace.profile.country,
    regionId: workspace.profile.regionId,
    locationDetail: workspace.profile.locationDetail ?? '',
    whatsappNumber: workspace.profile.whatsappNumber ?? '',
    specializationIds: workspace.profile.specializationIds ?? [],
    availabilityStatus: workspace.profile.availabilityStatus ?? 'available',
  });
  const [managedCases, setManagedCases] = useState(() => getRegionalCases(workspace.profile.regionId));
  const [caseDrafts, setCaseDrafts] = useState<
    Record<string, { caseStatus: 'new' | 'triaged' | 'in-progress' | 'resolved'; diagnosisSummary: string; responseNote: string; recommendedProduct: string }>
  >({});

  useEffect(() => {
    setProfileForm({
      fullName: workspace.profile.fullName,
      country: workspace.profile.country,
      regionId: workspace.profile.regionId,
      locationDetail: workspace.profile.locationDetail ?? '',
      whatsappNumber: workspace.profile.whatsappNumber ?? '',
      specializationIds: workspace.profile.specializationIds ?? [],
      availabilityStatus: workspace.profile.availabilityStatus ?? 'available',
    });
  }, [workspace.profile]);

  useEffect(() => {
    syncRegionalCaseSeeds(workspace.regionalCases);
    const nextCases = getRegionalCases(workspace.profile.regionId);
    setManagedCases(nextCases);
    setCaseDrafts(
      nextCases.reduce<Record<string, { caseStatus: 'new' | 'triaged' | 'in-progress' | 'resolved'; diagnosisSummary: string; responseNote: string; recommendedProduct: string }>>((accumulator, entry) => {
        accumulator[entry.id] = {
          caseStatus: entry.caseStatus ?? 'new',
          diagnosisSummary: entry.diagnosisSummary ?? '',
          responseNote: entry.responseNote ?? '',
          recommendedProduct: entry.recommendedProduct ?? '',
        };
        return accumulator;
      }, {}),
    );
  }, [workspace.profile.regionId, workspace.regionalCases]);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveProfile(workspace.profile, profileForm);
  }

  const urgentCases = workspace.regionalCases.filter((entry) =>
    ['armyworm', 'mould', 'borer', 'rust', 'smut'].some((term) => entry.note.toLowerCase().includes(term)),
  ).length;

  return (
    <main className="dashboard-grid agronomist-mode">
      <section className="card toolbar-card">
        <div className="toolbar-row">
          <div>
            <p className="section-kicker">Agronomist workspace</p>
            <h2>{workspace.profile.fullName}</h2>
            <p className="muted">{workspace.profile.email}</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
              Refresh
            </button>
            <button className="secondary-button" type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="sync-strip">
          <span className={`sync-badge ${backend.mode}`}>{backend.mode === 'online' ? 'Online backend' : 'Demo backend'}</span>
          <span>{backend.detail}</span>
        </div>
        {statusMessage ? <p className="muted">{statusMessage}</p> : null}
      </section>

      <section className="card account-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Profile</p>
            <h2>Agronomist details</h2>
          </div>
          <span className="badge success">{formatAvailability(profileForm.availabilityStatus)}</span>
        </div>

        <form className="form-grid" onSubmit={handleProfileSave}>
          <label>
            Full name
            <input
              required
              type="text"
              value={profileForm.fullName}
              onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>
          <label>
            Country
            <select
              value={profileForm.country}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  country: event.target.value as UserProfile['country'],
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
              value={profileForm.regionId}
              onChange={(event) => setProfileForm((current) => ({ ...current, regionId: event.target.value }))}
            >
              {regions
                .filter((region) => region.country === profileForm.country)
                .map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Location detail
            <input
              required
              type="text"
              value={profileForm.locationDetail}
              onChange={(event) => setProfileForm((current) => ({ ...current, locationDetail: event.target.value }))}
              placeholder="Service corridor, depot, or district"
            />
          </label>
          <label>
            WhatsApp number
            <input
              required
              type="text"
              value={profileForm.whatsappNumber}
              onChange={(event) => setProfileForm((current) => ({ ...current, whatsappNumber: event.target.value }))}
              placeholder="+263..."
            />
          </label>
          <label>
            Availability
            <select
              value={profileForm.availabilityStatus}
              onChange={(event) =>
                setProfileForm((current) => ({
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
            <p className="section-kicker">Specialties</p>
            <div className="chip-selector-grid">
              {agronomistSpecialties.map((specialty) => {
                const selected = profileForm.specializationIds.includes(specialty.id);
                return (
                  <button
                    className={`chip-selector ${selected ? 'selected' : ''}`}
                    key={specialty.id}
                    type="button"
                    onClick={() =>
                      setProfileForm((current) => ({
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
          <button className="primary-button" disabled={busy} type="submit">
            Save agronomist profile
          </button>
        </form>
      </section>

      <section className="card weather-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Region queue</p>
            <h2>Regional demand</h2>
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <span>Farmers in region</span>
            <strong>{workspace.regionalFarmers.length}</strong>
          </div>
          <div className="metric-card">
            <span>Open crop cases</span>
            <strong>{workspace.regionalCases.length}</strong>
          </div>
          <div className="metric-card">
            <span>Urgent watch cases</span>
            <strong>{urgentCases}</strong>
          </div>
        </div>
        <div className="notice-callout">
          <strong>Farmer-facing listing preview</strong>
          <span>{profileForm.locationDetail || 'Set your service location'} | {profileForm.whatsappNumber || 'Add WhatsApp contact'}</span>
          <span>Farmers in your region will see you when your specialties match their crop or issue.</span>
        </div>
      </section>

      <section className="card advisory-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Regional cases</p>
            <h2>Farmer enquiries in {regions.find((region) => region.id === workspace.profile.regionId)?.name ?? workspace.profile.regionId}</h2>
          </div>
          <span className="badge accent">{workspace.regionalCases.length} cases</span>
        </div>

        {workspace.regionalCases.length ? (
          <div className="service-grid">
            {managedCases.slice(0, 8).map((entry) => (
              <article className="service-card" key={entry.id}>
                <span className={`badge ${entry.caseStatus === 'resolved' ? 'success' : entry.priority === 'urgent' ? 'warning' : 'neutral'}`}>
                  {entry.caseStatus ?? 'new'}
                </span>
                <strong>{entry.farmerName}</strong>
                <p>{crops.find((crop) => crop.id === entry.cropId)?.name ?? entry.cropId}</p>
                <p>{entry.note}</p>
                <small>{entry.farmerEmail}</small>
                <small>{entry.assignedAgronomistName ?? 'Unassigned'}</small>
                <small>{formatDate(entry.createdAt.slice(0, 10))}</small>
                {entry.imageUrl ? (
                  <a className="inline-link" href={entry.imageUrl} rel="noreferrer" target="_blank">
                    Open photo
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No farmer cases are assigned to this region yet.</p>
        )}

        {managedCases.length ? (
          <div className="service-grid top-gap">
            {managedCases.slice(0, 4).map((entry) => {
              const draft = caseDrafts[entry.id];
              return (
                <article className="service-card transaction-admin-card" key={`${entry.id}-manage`}>
                  <span className="service-kind">{entry.farmerName}</span>
                  <strong>{crops.find((crop) => crop.id === entry.cropId)?.name ?? entry.cropId}</strong>
                  <div className="form-grid compact">
                    <label>
                      Status
                      <select
                        value={draft?.caseStatus ?? entry.caseStatus ?? 'new'}
                        onChange={(event) =>
                          setCaseDrafts((current) => ({
                            ...current,
                            [entry.id]: {
                              ...current[entry.id],
                              caseStatus: event.target.value as 'new' | 'triaged' | 'in-progress' | 'resolved',
                            },
                          }))
                        }
                      >
                        <option value="new">New</option>
                        <option value="triaged">Triaged</option>
                        <option value="in-progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                    <label>
                      Diagnosis summary
                      <input
                        type="text"
                        value={draft?.diagnosisSummary ?? ''}
                        onChange={(event) =>
                          setCaseDrafts((current) => ({
                            ...current,
                            [entry.id]: {
                              ...current[entry.id],
                              diagnosisSummary: event.target.value,
                            },
                          }))
                        }
                        placeholder="Likely pest, disease, or nutrition issue"
                      />
                    </label>
                    <label>
                      Recommended product
                      <input
                        type="text"
                        value={draft?.recommendedProduct ?? ''}
                        onChange={(event) =>
                          setCaseDrafts((current) => ({
                            ...current,
                            [entry.id]: {
                              ...current[entry.id],
                              recommendedProduct: event.target.value,
                            },
                          }))
                        }
                        placeholder="Suggested Zimbabwe-approved product"
                      />
                    </label>
                    <label>
                      Response note
                      <input
                        type="text"
                        value={draft?.responseNote ?? ''}
                        onChange={(event) =>
                          setCaseDrafts((current) => ({
                            ...current,
                            [entry.id]: {
                              ...current[entry.id],
                              responseNote: event.target.value,
                            },
                          }))
                        }
                        placeholder="Field response and next step"
                      />
                    </label>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      if (!draft) {
                        return;
                      }

                      updateAgronomistCase({
                        agronomist: workspace.profile,
                        caseId: entry.id,
                        caseStatus: draft.caseStatus,
                        diagnosisSummary: draft.diagnosisSummary,
                        responseNote: draft.responseNote,
                        recommendedProduct: draft.recommendedProduct,
                      });
                      const nextCases = getRegionalCases(workspace.profile.regionId);
                      setManagedCases(nextCases);
                    }}
                  >
                    Save case update
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}

        <div className="table-shell top-gap">
          <table>
            <thead>
              <tr>
                <th>Farmer</th>
                <th>Crop</th>
                <th>Area</th>
                <th>Planting</th>
                <th>Board</th>
              </tr>
            </thead>
            <tbody>
              {workspace.regionalFarmers.slice(0, 8).map((farmer) => (
                <tr key={`${farmer.farmerId}-${farmer.cropId}`}>
                  <td>
                    <strong>{farmer.fullName}</strong>
                    <div className="table-subtext">{farmer.email}</div>
                  </td>
                  <td>{crops.find((crop) => crop.id === farmer.cropId)?.name ?? farmer.cropId}</td>
                  <td>{farmer.totalAreaHa.toFixed(1)} ha</td>
                  <td>{formatDate(farmer.plantingDate)}</td>
                  <td>{farmer.boardStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default AgronomistWorkspace;
