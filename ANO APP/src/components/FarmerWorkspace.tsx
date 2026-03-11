import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { boards, crops, regions, type CropIssue } from '../data';
import ActionStrip from './ActionStrip';
import FarmBusinessDesk from './FarmBusinessDesk';
import FieldMapPanel from './FieldMapPanel';
import FarmerOperationsDesk from './FarmerOperationsDesk';
import SeasonOutlookPanel from './SeasonOutlookPanel';
import { diagnoseCropIssue, type CropDiagnosisResult } from '../lib/diagnosis';
import { buildBudgetSummary, buildPlantingProgressSummary, formatUsd, getIssueRecommendation } from '../lib/economics';
import {
  buildWhatsappLink,
  formatAvailability,
  getAvailabilityTone,
  getSpecialtyLabel,
  matchAgronomists,
} from '../lib/agronomists';
import type {
  BackendStatus,
  BoardLinkInput,
  FarmTeamInviteInput,
  BoardTransactionInput,
  CropEnquiryInput,
  CropPlanInput,
  FarmerWorkspace as FarmerWorkspaceData,
  PlantingProgressInput,
  UserProfile,
} from '../lib/app-types';
import type { AppPreferences } from '../lib/preferences';
import { getAppCopy } from '../lib/preferences';
import {
  getMobilePlatformLabel,
  captureCropPhotoFromDevice,
  isNativeMobileApp,
} from '../lib/mobile';
import {
  buildFarmReminders,
  getNotificationPermissionState,
  maybeSendReminderNotification,
  notificationsSupported,
  readNotificationPermission,
  requestNotificationPermission,
} from '../lib/reminders';
import {
  buildWeatherFallback,
  fetchWeather,
  formatDate,
  getLocalIsoDate,
  getWeatherAdvice,
  summarizeAlerts,
  type WeatherSummary,
} from '../lib/weather';

function addDays(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

interface FarmerWorkspaceProps {
  backend: BackendStatus;
  workspace: FarmerWorkspaceData;
  preferences: AppPreferences;
  statusMessage: string;
  busy: boolean;
  syncing: boolean;
  onSaveProfile: (profile: UserProfile, updates: Partial<UserProfile>) => Promise<void>;
  onSavePlan: (profile: UserProfile, input: CropPlanInput) => Promise<void>;
  onSavePlantingRecord: (profile: UserProfile, input: PlantingProgressInput) => Promise<void>;
  onSaveTeamInvite: (profile: UserProfile, input: FarmTeamInviteInput) => Promise<void>;
  onSaveTransaction: (profile: UserProfile, input: BoardTransactionInput) => Promise<void>;
  onLinkBoard: (profile: UserProfile, input: BoardLinkInput) => Promise<void>;
  onSubmitEnquiry: (profile: UserProfile, input: CropEnquiryInput) => Promise<void>;
  onSyncNow: (profile: UserProfile) => Promise<void>;
  onSignOut: () => Promise<void>;
}

function getVarieties(regionId: string, country: UserProfile['country'], cropId?: string) {
  const crop = crops.find((entry) => entry.id === cropId);
  if (!crop) {
    return [];
  }

  return crop.varieties.filter((variety) => {
    const matchesCountry = !variety.countries || variety.countries.includes(country);
    const matchesRegion = !variety.regionIds || variety.regionIds.includes(regionId);
    return matchesCountry && matchesRegion;
  });
}

function DiagnosisBox({
  cropId,
  issue,
  diagnosis,
  note,
}: {
  cropId: CropPlanInput['cropId'];
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
      {recommendation.source ? (
        <p className="muted">
          Zimbabwe source: <a href={recommendation.source.url} rel="noreferrer" target="_blank">{recommendation.source.vendor}</a>
          {` | checked ${formatDate(recommendation.source.checkedOn)}`}
        </p>
      ) : null}
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

function FarmerWorkspace({
  backend,
  workspace,
  preferences,
  statusMessage,
  busy,
  syncing,
  onSaveProfile,
  onSavePlan,
  onSavePlantingRecord,
  onSaveTeamInvite,
  onSaveTransaction,
  onLinkBoard,
  onSubmitEnquiry,
  onSyncNow,
  onSignOut,
}: FarmerWorkspaceProps) {
  const copy = getAppCopy(preferences.language);
  const [profileForm, setProfileForm] = useState({
    fullName: workspace.profile.fullName,
    country: workspace.profile.country,
    regionId: workspace.profile.regionId,
  });
  const [selectedCropId, setSelectedCropId] = useState<CropPlanInput['cropId']>(
    workspace.plans[0]?.cropId ?? regions.find((region) => region.id === workspace.profile.regionId)?.crops[0] ?? 'maize',
  );
  const [planForm, setPlanForm] = useState({
    plantingDate: workspace.plans[0]?.plantingDate ?? getLocalIsoDate(),
    totalAreaHa: String(workspace.plans[0]?.totalAreaHa ?? ''),
  });
  const [progressForm, setProgressForm] = useState({ entryDate: getLocalIsoDate(), areaHa: '' });
  const [teamInviteForm, setTeamInviteForm] = useState({ label: '', teamRole: 'worker' as const });
  const [boardLinkForm, setBoardLinkForm] = useState({ growerId: '', pin: '' });
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [issueId, setIssueId] = useState('');
  const [enquiryNote, setEnquiryNote] = useState('');
  const [diagnosis, setDiagnosis] = useState<CropDiagnosisResult | null>(null);
  const [diagnosisBusy, setDiagnosisBusy] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState('');
  const [planningError, setPlanningError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(getNotificationPermissionState);
  const mobilePlatformLabel = getMobilePlatformLabel();
  const nativeMobileApp = isNativeMobileApp();

  const region = regions.find((entry) => entry.id === profileForm.regionId) ?? regions[0];
  const availableCrops = crops.filter((crop) => region.crops.includes(crop.id));
  const selectedCrop = crops.find((crop) => crop.id === selectedCropId) ?? null;
  const selectedPlan = workspace.plans.find((plan) => plan.cropId === selectedCropId) ?? null;
  const selectedEntries = useMemo(
    () =>
      workspace.plantingEntries
        .filter((entry) => entry.cropId === selectedCropId)
        .sort((left, right) => right.entryDate.localeCompare(left.entryDate)),
    [selectedCropId, workspace.plantingEntries],
  );
  const selectedBoard = boards.find((board) => board.id === (selectedPlan?.boardId ?? selectedCrop?.boardId));
  const selectedTransaction = workspace.transactions.find((transaction) => transaction.cropId === selectedCropId) ?? null;
  const recommendedVarieties = useMemo(
    () => getVarieties(profileForm.regionId, profileForm.country, selectedCrop?.id),
    [profileForm.country, profileForm.regionId, selectedCrop?.id],
  );
  const currentIssue =
    selectedCrop?.issues.find((issue) => issue.id === issueId) ?? selectedCrop?.issues[0] ?? null;
  const progressSummary = buildPlantingProgressSummary(selectedPlan, selectedEntries);
  const plannedArea = Number(planForm.totalAreaHa || 0);
  const budget = selectedCrop
    ? buildBudgetSummary(
        selectedCrop.id,
        selectedPlan?.totalAreaHa ?? plannedArea,
        selectedPlan?.plantingDate ?? planForm.plantingDate,
        weather,
      )
    : null;
  const alerts = summarizeAlerts(selectedCrop, selectedPlan?.plantingDate ?? planForm.plantingDate, weather);
  const reminders = buildFarmReminders({
    crop: selectedCrop,
    plan: selectedPlan,
    transaction: selectedTransaction,
    progressSummary,
    weather,
    alerts,
  });
  const agronomistMatches = matchAgronomists({
    agronomists: workspace.agronomists,
    country: workspace.profile.country,
    regionId: region.id,
    cropId: selectedCrop?.id,
    issueCategory: currentIssue?.category ?? diagnosis?.issue.category ?? null,
  });
  const lockReason = !selectedPlan
    ? 'Save the crop plan with hectares to unlock guidance.'
    : selectedPlan.boardStatus === 'not-linked'
      ? 'Link the farmer to the board to fully unlock crop guidance.'
      : '';

  useEffect(() => {
    setProfileForm({
      fullName: workspace.profile.fullName,
      country: workspace.profile.country,
      regionId: workspace.profile.regionId,
    });
  }, [workspace.profile]);

  useEffect(() => {
    if (!availableCrops.some((crop) => crop.id === selectedCropId)) {
      setSelectedCropId(availableCrops[0]?.id ?? 'maize');
    }
  }, [availableCrops, selectedCropId]);

  useEffect(() => {
    if (selectedPlan) {
      setPlanForm({
        plantingDate: selectedPlan.plantingDate,
        totalAreaHa: String(selectedPlan.totalAreaHa),
      });
    } else {
      setPlanForm({
        plantingDate: getLocalIsoDate(),
        totalAreaHa: '',
      });
    }
  }, [selectedPlan?.cropId, selectedPlan?.plantingDate, selectedPlan?.totalAreaHa]);

  useEffect(() => {
    setDiagnosis(null);
    setDiagnosisError('');
    setIssueId(selectedCrop?.issues[0]?.id ?? '');
  }, [selectedCrop?.id]);

  useEffect(() => {
    let cancelled = false;
    setWeatherLoading(true);
    setWeatherError('');

    fetchWeather(region.id, region.coordinates.lat, region.coordinates.lon)
      .then((result) => {
        if (!cancelled) {
          setWeather(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWeather(buildWeatherFallback(region.id, region.coordinates.lat, region.coordinates.lon));
          setWeatherError('Live weather could not be reached, so the dashboard switched to a seasonal fallback estimate.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [region.coordinates.lat, region.coordinates.lon, region.id]);

  useEffect(() => {
    if (!preferences.alertsEnabled || !notificationsSupported()) {
      return;
    }

    void readNotificationPermission().then((permission) => {
      if (permission === 'default') {
        void requestNotificationPermission().then((nextPermission) => {
          setNotificationPermission(nextPermission);
        });
        return;
      }

      setNotificationPermission(permission);
    });
  }, [preferences.alertsEnabled]);

  useEffect(() => {
    if (!preferences.alertsEnabled || notificationPermission !== 'granted' || !selectedCrop) {
      return;
    }

    maybeSendReminderNotification(reminders[0] ?? null, selectedCrop.name);
  }, [notificationPermission, preferences.alertsEnabled, reminders, selectedCrop]);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveProfile(workspace.profile, profileForm);
  }

  async function handlePlanSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCrop) {
      return;
    }

    const totalAreaHa = Number(planForm.totalAreaHa);
    if (!Number.isFinite(totalAreaHa) || totalAreaHa <= 0) {
      setPlanningError('Enter the total hectares for this crop before saving the plan.');
      return;
    }

    setPlanningError('');
    await onSavePlan(workspace.profile, {
      cropId: selectedCrop.id,
      plantingDate: planForm.plantingDate,
      totalAreaHa,
    });
  }

  async function handlePlantingSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCrop || !selectedPlan) {
      setProgressError('Save the crop plan first so daily planting progress has a target.');
      return;
    }

    const areaHa = Number(progressForm.areaHa);
    if (!Number.isFinite(areaHa) || areaHa <= 0) {
      setProgressError('Enter the hectares planted on that day.');
      return;
    }

    if (progressSummary.remainingAreaHa > 0 && areaHa - progressSummary.remainingAreaHa > 0.001) {
      setProgressError('This entry is bigger than the remaining planned area.');
      return;
    }

    setProgressError('');
    await onSavePlantingRecord(workspace.profile, {
      cropId: selectedCrop.id,
      entryDate: progressForm.entryDate,
      areaHa,
    });
    setProgressForm((current) => ({ ...current, areaHa: '' }));
  }

  async function handleBoardLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCrop) {
      return;
    }

    await onLinkBoard(workspace.profile, {
      cropId: selectedCrop.id,
      growerId: boardLinkForm.growerId,
      pin: boardLinkForm.pin,
    });
    setBoardLinkForm({ growerId: '', pin: '' });
  }

  async function handleTeamInviteSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveTeamInvite(workspace.profile, teamInviteForm);
    setTeamInviteForm({ label: '', teamRole: 'worker' });
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDiagnosis(null);
    setDiagnosisError('');
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(undefined);
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : undefined);
    reader.readAsDataURL(file);
  }

  async function handleNativePhotoCapture() {
    setDiagnosis(null);
    setDiagnosisError('');

    try {
      const capture = await captureCropPhotoFromDevice();
      setPhotoFile(capture.file);
      setPhotoPreview(capture.previewUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the device camera right now.';
      if (message.toLowerCase().includes('cancel')) {
        return;
      }

      setDiagnosisError(message);
    }
  }

  async function handleRunDiagnosis() {
    if (!selectedCrop || !currentIssue) {
      return;
    }

    setDiagnosisBusy(true);
    setDiagnosisError('');
    try {
      const result = await diagnoseCropIssue({
        cropId: selectedCrop.id,
        note: enquiryNote,
        imageDataUrl: photoPreview,
        fallbackIssueId: currentIssue.id,
      });
      setDiagnosis(result);
    } catch (error) {
      setDiagnosisError(error instanceof Error ? error.message : 'Unable to diagnose the crop issue right now.');
    } finally {
      setDiagnosisBusy(false);
    }
  }

  async function handleEnquirySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCrop || !issueId) {
      return;
    }

    await onSubmitEnquiry(workspace.profile, {
      cropId: selectedCrop.id,
      issueId,
      note: enquiryNote,
      imageFile: photoFile,
    });
    setEnquiryNote('');
    setPhotoFile(null);
    setPhotoPreview(undefined);
    setDiagnosis(null);
  }

  return (
    <main className="dashboard-grid">
      <section className={`card toolbar-card crop-hero crop-theme-${selectedCrop?.id ?? 'maize'}`}>
        <div className="toolbar-row">
          <div>
            <p className="section-kicker">Farmer workspace</p>
            <h2>{workspace.profile.fullName}</h2>
            <p className="muted">{workspace.profile.email}</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" disabled={syncing} type="button" onClick={() => onSyncNow(workspace.profile)}>
              {syncing ? 'Syncing...' : `Sync now (${workspace.pendingSyncCount})`}
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

      <ActionStrip
        reminders={reminders}
        subtitle={copy.todaySubtitle}
        title={copy.todayTitle}
      />

      <section className="card account-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Account</p>
            <h2>Farmer details</h2>
          </div>
          <span className="badge success">Authenticated</span>
        </div>
        <form className="form-grid" onSubmit={handleProfileSave}>
          <label>
            Full name
            <input required type="text" value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} />
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
            <select value={profileForm.regionId} onChange={(event) => setProfileForm((current) => ({ ...current, regionId: event.target.value }))}>
              {regions.filter((entry) => entry.country === profileForm.country).map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={busy} type="submit">Save profile</button>
        </form>
        <p className="muted">Region snapshot: {region.rainfallPattern}</p>
      </section>

      <section className="card board-card reveal-panel">
        <div className="section-header">
          <div>
            <p className="section-kicker">Farm team</p>
            <h2>Staff and worker access</h2>
          </div>
          <span className="badge accent">{workspace.teamMembers.length} active</span>
        </div>
        <form className="form-grid compact" onSubmit={handleTeamInviteSave}>
          <label>
            Invite label
            <input
              required
              type="text"
              value={teamInviteForm.label}
              onChange={(event) => setTeamInviteForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="e.g. Sprayer team, field scout, irrigation lead"
            />
          </label>
          <label>
            Team role
            <select
              value={teamInviteForm.teamRole}
              onChange={(event) =>
                setTeamInviteForm((current) => ({
                  ...current,
                  teamRole: event.target.value as typeof current.teamRole,
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
          {workspace.teamInvites.slice(0, 3).map((invite) => (
            <article className="service-card" key={invite.id}>
              <span className={`badge ${invite.isActive ? 'success' : 'neutral'}`}>{invite.teamRole}</span>
              <strong>{invite.label}</strong>
              <p>{invite.inviteCode}</p>
              <small>{invite.isActive ? 'Share this code with the staff member to sign up.' : 'Invite already claimed.'}</small>
            </article>
          ))}
          {workspace.teamMembers.slice(0, 3).map((member) => (
            <article className="service-card" key={member.id}>
              <span className="badge accent">{member.teamRole}</span>
              <strong>{member.fullName}</strong>
              <p>{member.email || 'Awaiting profile email'}</p>
              <small>Active on the farm team</small>
            </article>
          ))}
          {!workspace.teamInvites.length && !workspace.teamMembers.length ? (
            <article className="service-card">
              <strong>No team accounts yet</strong>
              <p>Create an invite code above, then let the worker or scout sign up from the main auth screen.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className={`card crop-card crop-theme-${selectedCrop?.id ?? 'maize'} reveal-panel`}>
        <div className="section-header">
          <div>
            <p className="section-kicker">Planning</p>
            <h2>Available crops for {region.name}</h2>
          </div>
          {selectedCrop ? <span className="badge">{selectedCrop.name}</span> : null}
        </div>
        {workspace.plans.length ? (
          <div className="saved-plan-row">
            {workspace.plans.map((plan) => (
              <button className={`plan-chip ${plan.cropId === selectedCropId ? 'selected' : ''}`} key={plan.id} type="button" onClick={() => setSelectedCropId(plan.cropId)}>
                {crops.find((crop) => crop.id === plan.cropId)?.name} | {plan.totalAreaHa} ha
              </button>
            ))}
          </div>
        ) : null}
        <div className="crop-grid">
          {availableCrops.map((crop) => (
            <button className={`crop-tile ${selectedCropId === crop.id ? 'selected' : ''}`} key={crop.id} type="button" onClick={() => setSelectedCropId(crop.id)}>
              <span className="crop-icon">{crop.icon}</span>
              <strong>{crop.name}</strong>
              <span>{crop.summary}</span>
            </button>
          ))}
        </div>
        <form className="form-grid compact top-gap" onSubmit={handlePlanSave}>
          <label>
            Planting start date
            <input required type="date" value={planForm.plantingDate} onChange={(event) => setPlanForm((current) => ({ ...current, plantingDate: event.target.value }))} />
          </label>
          <label>
            Total hectares to farm
            <input min="0.1" required step="0.1" type="number" value={planForm.totalAreaHa} onChange={(event) => setPlanForm((current) => ({ ...current, totalAreaHa: event.target.value }))} placeholder="e.g. 12.5" />
          </label>
          <button className="primary-button" disabled={busy || !selectedCrop} type="submit">
            {selectedPlan ? 'Update crop plan' : 'Save crop plan'}
          </button>
        </form>
        {planningError ? <p className="muted">{planningError}</p> : null}
      </section>

      <section className={`card progress-card crop-theme-${selectedCrop?.id ?? 'maize'} reveal-panel`}>
        <div className="section-header">
          <div>
            <p className="section-kicker">Planting progress</p>
            <h2>Track hectares planted each day</h2>
          </div>
          <span className={`badge ${progressSummary.status === 'completed' ? 'success' : progressSummary.status === 'in-progress' ? 'warning' : 'neutral'}`}>
            {progressSummary.status.replace('-', ' ')}
          </span>
        </div>
        <div className="metric-grid planting-metric-grid">
          <div className="metric-card"><span>Total planned</span><strong>{progressSummary.totalAreaHa.toFixed(1)} ha</strong></div>
          <div className="metric-card"><span>Planted to date</span><strong>{progressSummary.plantedAreaHa.toFixed(1)} ha</strong></div>
          <div className="metric-card"><span>Remaining</span><strong>{progressSummary.remainingAreaHa.toFixed(1)} ha</strong></div>
        </div>
        <div className="progress-bar-shell" aria-label="Planting completion">
          <div className="progress-bar-fill" style={{ width: `${progressSummary.completionPercent}%` }} />
        </div>
        <p className="muted">
          Completion: {progressSummary.completionPercent.toFixed(0)}%
          {progressSummary.lastEntryDate ? ` | Last record ${formatDate(progressSummary.lastEntryDate)}` : ''}
        </p>
        <form className="form-grid compact" onSubmit={handlePlantingSave}>
          <label>
            Date planted
            <input required type="date" value={progressForm.entryDate} onChange={(event) => setProgressForm((current) => ({ ...current, entryDate: event.target.value }))} />
          </label>
          <label>
            Hectares planted that day
            <input min="0.1" required step="0.1" type="number" value={progressForm.areaHa} onChange={(event) => setProgressForm((current) => ({ ...current, areaHa: event.target.value }))} placeholder="e.g. 2.5" />
          </label>
          <button className="secondary-button" disabled={busy || !selectedPlan} type="submit">Save daily record</button>
        </form>
        {progressError ? <p className="muted">{progressError}</p> : null}
        {selectedEntries.length ? (
          <div className="table-shell top-gap">
            <table>
              <thead>
                <tr><th>Date</th><th>Area planted</th><th>Status</th></tr>
              </thead>
              <tbody>
                {selectedEntries.slice(0, 6).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.entryDate)}</td>
                    <td>{entry.areaHa.toFixed(1)} ha</td>
                    <td>{entry.syncState === 'pending' ? 'Waiting to sync' : 'Stored'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No daily planting records have been saved for this crop yet.</p>
        )}
      </section>

      <section className="card board-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Board link</p>
            <h2>Buyer verification</h2>
          </div>
          {selectedPlan ? <span className={`badge ${selectedPlan.boardStatus === 'verified' ? 'success' : selectedPlan.boardStatus === 'linked' ? 'warning' : 'neutral'}`}>{selectedPlan.boardStatus}</span> : null}
        </div>
        {selectedBoard && selectedCrop ? (
          <>
            <p className="muted">
              {!selectedPlan
                ? `Save ${selectedCrop.name} with total hectares first, then link to ${selectedBoard.name}.`
                : selectedPlan.boardStatus === 'verified'
                  ? `${selectedBoard.name} already recognizes this farmer record for ${selectedCrop.name}.`
                  : selectedBoard.farmerPrompt}
            </p>
            {selectedPlan?.boardStatus !== 'verified' ? (
              <form className="form-grid compact" onSubmit={handleBoardLink}>
                <label>
                  {selectedBoard.growerIdLabel}
                  <input required type="text" value={boardLinkForm.growerId} onChange={(event) => setBoardLinkForm((current) => ({ ...current, growerId: event.target.value }))} placeholder="Enter grower or contract number" />
                </label>
                <label>
                  Board PIN
                  <input required type="password" value={boardLinkForm.pin} onChange={(event) => setBoardLinkForm((current) => ({ ...current, pin: event.target.value }))} placeholder="Enter your board PIN" />
                </label>
                <button className="secondary-button" disabled={busy || !selectedPlan} type="submit">Link board record</button>
              </form>
            ) : (
              <div className="confirmation">Grower ID: <strong>{selectedPlan.growerId ?? 'Verified'}</strong></div>
            )}
            {backend.mode === 'demo' ? (
              <div className="demo-note">
                Demo matches: `Tendai Moyo / GMB-1048 / 2468`, `Blessing Dube / TIMB-4431 / 1188`,
                `Farai Chikowore / SUG-7024 / 3377`, `Sipho Dlamini / SUG-9012 / 5521`.
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">Pick a crop so the app can attach the correct buyer board.</p>
        )}
      </section>

      <section className="card weather-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Weather</p>
            <h2>Forecast and alerts</h2>
          </div>
          {weather ? <span className="badge">{weather.source === 'live' ? 'Live forecast' : 'Fallback forecast'}</span> : null}
        </div>
        {weatherLoading ? (
          <p className="muted">Loading regional weather forecast...</p>
        ) : weather ? (
          <div className="weather-layout">
            <div className="weather-stat"><span>Today</span><strong>{weather.todayMaxTemp} C</strong><small>{weather.todayRainChance}% rain chance</small></div>
            <div className="weather-stat"><span>Tomorrow</span><strong>{weather.tomorrowRainMm} mm</strong><small>{weather.tomorrowRainChance}% chance of rain</small></div>
            <div className="weather-advice"><p>{getWeatherAdvice(weather, selectedCrop)}</p></div>
          </div>
        ) : null}
        {weatherError ? <p className="muted">{weatherError}</p> : null}
        <div className="notice-callout">
          <strong>Reminder center</strong>
          <span>
            {preferences.alertsEnabled
              ? notificationPermission === 'granted'
                ? 'Device alerts are enabled for urgent field reminders while the app is active.'
                : 'Turn on browser notification permission to receive urgent reminders on this device.'
              : 'Turn on device alerts from App preferences to get urgent planting, weather, and board reminders.'}
          </span>
        </div>
        {alerts.length ? (
          <div className="alert-list">
            {alerts.map((alert) => <div className="alert-pill" key={alert}>{alert}</div>)}
          </div>
        ) : (
          <p className="muted">Select a crop plan to generate fertiliser and irrigation alerts.</p>
        )}
      </section>

      <section className={`card advisory-card crop-theme-${selectedCrop?.id ?? 'maize'} reveal-panel ${lockReason ? 'locked' : ''}`} data-lock-reason={lockReason}>
        <div className="section-header">
          <div>
            <p className="section-kicker">Advisory</p>
            <h2>Crop dashboard</h2>
          </div>
          {selectedCrop ? <span className="badge accent">{selectedCrop.name}</span> : null}
        </div>
        {selectedCrop ? (
          <div className="advisory-grid">
            <article className="subcard">
              <h3>Best varieties</h3>
              {recommendedVarieties.length ? (
                <ul className="stack-list">
                  {recommendedVarieties.map((variety) => (
                    <li key={variety.name}>
                      <strong>{variety.name}</strong>
                      <span>{variety.fit}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No exact variety rule has been loaded for this crop and region yet.</p>
              )}
            </article>

            <article className="subcard">
              <h3>Irrigation guidance</h3>
              <p>{selectedCrop.irrigationPlan}</p>
              <p className="muted">Planning anchor: {formatDate(selectedPlan?.plantingDate ?? planForm.plantingDate)}</p>
              <p className="muted">Total planned area: {(selectedPlan?.totalAreaHa ?? plannedArea).toFixed(1)} ha</p>
            </article>

            <SeasonOutlookPanel
              country={workspace.profile.country}
              currentCropId={selectedCrop.id}
              defaultAreaHa={(selectedPlan?.totalAreaHa ?? plannedArea) || 1}
              regionId={region.id}
              weather={weather}
            />

            <FieldMapPanel
              cropName={selectedCrop.name}
              pins={workspace.enquiries
                .filter((entry) => entry.cropId === selectedCrop.id)
                .slice(0, 3)
                .map((entry) => ({
                  label:
                    selectedCrop.issues.find((issue) => issue.id === entry.issueId)?.title ?? 'Field enquiry',
                  detail: entry.note,
                }))}
              plantedAreaHa={progressSummary.plantedAreaHa}
              regionName={region.name}
              remainingAreaHa={progressSummary.remainingAreaHa}
              totalAreaHa={progressSummary.totalAreaHa}
            />

            <article className="subcard budget-card">
              <div className="section-header compact-header">
                <div>
                  <h3>Input budget and store prices</h3>
                  <p className="muted">Budget snapshot tied to the saved hectares for this crop.</p>
                </div>
                {budget ? <span className="badge success">{formatUsd(budget.knownCostUsd)}</span> : null}
              </div>
              {budget?.seedSummary ? (
                <div className="budget-summary">
                  <div className="metric-card compact-metric">
                    <span>Seed or planting material</span>
                    <strong>{budget.seedSummary.packsNeeded}</strong>
                    <small>{budget.seedSummary.packLabel} packs</small>
                  </div>
                  <div className="metric-card compact-metric">
                    <span>Required quantity</span>
                    <strong>{budget.seedSummary.quantityLabel}</strong>
                    <small>{formatUsd(budget.seedSummary.estimatedCostUsd)}</small>
                  </div>
                </div>
              ) : null}
              {budget ? (
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr><th>Stage</th><th>Product</th><th>Need</th><th>Packs</th><th>Cost</th></tr>
                    </thead>
                    <tbody>
                      {budget.stageLines.map((line) => (
                        <tr key={line.id}>
                          <td><strong>{line.title}</strong><div className="table-subtext">{formatDate(line.plannedDate)}</div></td>
                          <td>
                            <strong>{line.productName}</strong>
                            <div className="table-subtext"><a href={line.source.url} rel="noreferrer" target="_blank">{line.source.vendor}</a>{` | ${formatDate(line.source.checkedOn)}`}</div>
                            {line.weatherDelay ? <div className="table-subtext status-warn">{line.weatherDelay}</div> : null}
                          </td>
                          <td>{line.quantityLabel}<div className="table-subtext">{line.stage}</div></td>
                          <td>{line.packsNeeded} x {line.packLabel}</td>
                          <td>{formatUsd(line.stageCostUsd)}<div className="table-subtext">{formatUsd(line.packPriceUsd)} each</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {budget?.quoteOnlyItems.length ? (
                <div className="quote-list">
                  {budget.quoteOnlyItems.map((item) => (
                    <div className="demo-note" key={item.title}><strong>{item.title}:</strong> {item.quantityLabel}. {item.note}</div>
                  ))}
                </div>
              ) : null}
            </article>

            <FarmBusinessDesk
              boardStatus={selectedPlan?.boardStatus ?? 'not-linked'}
              busy={busy}
              cropId={selectedCrop.id}
              diagnosis={diagnosis}
              enquiryNote={enquiryNote}
              issue={currentIssue}
              knownInputCostUsd={budget?.knownCostUsd ?? 0}
              onSaveTransaction={(input) => onSaveTransaction(workspace.profile, input)}
              regionId={region.id}
              totalAreaHa={selectedPlan?.totalAreaHa ?? plannedArea}
              transaction={selectedTransaction}
            />

            <FarmerOperationsDesk
              budget={budget}
              enquiries={workspace.enquiries}
              plantingEntries={workspace.plantingEntries}
              plans={workspace.plans}
              preferences={preferences}
              profile={workspace.profile}
              selectedCropId={selectedCrop.id}
            />

            <article className="subcard">
              <h3>Farming schedule</h3>
              <div className="timeline">
                {selectedCrop.schedule.map((task) => (
                  <div className="timeline-item" key={`${selectedCrop.id}-${task.title}`}>
                    <span className="timeline-day">Day {task.dayOffset}</span>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.note}</p>
                      <small>{task.input ? `${task.input}${task.amount ? ` | ${task.amount}` : ''}` : task.stage}</small>
                      <small>Planned for {formatDate(addDays(selectedPlan?.plantingDate ?? planForm.plantingDate, task.dayOffset))}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="subcard">
              <div className="section-header compact-header">
                <div>
                  <h3>{copy.agronomistTitle}</h3>
                  <p className="muted">Matched by region, crop, and the issue currently selected in the dashboard.</p>
                </div>
                <span className="badge accent">{agronomistMatches.length} listed</span>
              </div>
              <div className="service-grid">
                {agronomistMatches.length ? (
                  agronomistMatches.slice(0, 4).map((agronomist) => (
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
                            `${selectedCrop.name} support request from ${workspace.profile.fullName} in ${region.name}. Issue: ${currentIssue?.title ?? 'field issue'}.`,
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
                  <p className="muted">No agronomists match this crop and region yet. Add more agronomists in the backend to widen the support roster.</p>
                )}
              </div>
            </article>

            <article className="subcard">
              <h3>Live camera enquiry</h3>
              <form className="stack-form" onSubmit={handleEnquirySubmit}>
                {nativeMobileApp ? (
                  <button className="secondary-button" type="button" onClick={() => void handleNativePhotoCapture()}>
                    Open {mobilePlatformLabel} camera
                  </button>
                ) : null}
                <label className="file-label">
                  {nativeMobileApp ? 'Upload from phone gallery or files' : 'Capture or upload crop photo'}
                  <input accept="image/*" capture="environment" type="file" onChange={handlePhotoChange} />
                </label>
                {photoPreview ? <img alt="Crop preview" className="photo-preview" src={photoPreview} /> : null}
                <label>
                  Issue type
                  <select value={issueId} onChange={(event) => setIssueId(event.target.value)}>
                    {selectedCrop.issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.title}</option>)}
                  </select>
                </label>
                <label>
                  Farmer notes
                  <textarea rows={4} value={enquiryNote} onChange={(event) => setEnquiryNote(event.target.value)} placeholder="Describe yellowing, weeds, chewing damage, lesions or moisture stress." />
                </label>
                <div className="action-row">
                  <button className="secondary-button" disabled={diagnosisBusy || (!photoPreview && !enquiryNote)} type="button" onClick={() => void handleRunDiagnosis()}>
                    {diagnosisBusy ? 'Diagnosing...' : 'Run diagnosis'}
                  </button>
                  <button className="primary-button" disabled={busy} type="submit">Save enquiry</button>
                </div>
              </form>
              {diagnosisError ? <p className="muted">{diagnosisError}</p> : null}
              {currentIssue ? <DiagnosisBox cropId={selectedCrop.id} diagnosis={diagnosis} issue={currentIssue} note={enquiryNote} /> : null}
              <p className="muted">
                {nativeMobileApp
                  ? `On ${mobilePlatformLabel}, the app can open the phone camera directly.`
                  : 'Use the file picker to capture a live photo from the device camera or upload an existing image.'}{' '}
                The diagnosis flow uses a live endpoint only when `VITE_DIAGNOSIS_API_URL` is configured. Otherwise it falls back to symptom-guided Zimbabwe product advice and still stores the photo enquiry.
              </p>
            </article>
          </div>
        ) : (
          <p className="muted">Choose a crop to open the advisory dashboard.</p>
        )}

        {workspace.enquiries.length ? (
          <div className="recent-enquiries">
            <h3>Recent enquiries</h3>
            <div className="enquiry-grid">
              {workspace.enquiries.slice(0, 3).map((enquiry) => (
                <article className="subcard compact" key={enquiry.id}>
                  <strong>{crops.find((crop) => crop.id === enquiry.cropId)?.name}</strong>
                  <span className="muted">{formatDate(enquiry.createdAt.slice(0, 10))}</span>
                  <p>{enquiry.note}</p>
                  <small>{enquiry.syncState === 'pending' ? 'Waiting to sync' : 'Stored'}</small>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default FarmerWorkspace;
