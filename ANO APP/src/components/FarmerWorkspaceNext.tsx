import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { boards, crops, regions } from '../data';
import ActionStrip from './ActionStrip';
import FarmBusinessDesk from './FarmBusinessDesk';
import FarmerOperationsDesk from './FarmerOperationsDesk';
import FarmerSetupDashboard, { type SetupStepId } from './FarmerSetupDashboard';
import FarmerSupportDashboard from './FarmerSupportDashboard';
import FarmerWaterDashboard from './FarmerWaterDashboard';
import FieldMapPanel from './FieldMapPanel';
import SeasonOutlookPanel from './SeasonOutlookPanel';
import { diagnoseCropIssue, type CropDiagnosisResult } from '../lib/diagnosis';
import { buildBudgetSummary, buildPlantingProgressSummary, formatUsd } from '../lib/economics';
import { matchAgronomists } from '../lib/agronomists';
import type {
  BackendStatus,
  BoardLinkInput,
  BoardTransactionInput,
  CropEnquiryInput,
  CropPlanInput,
  FarmerWorkspace as FarmerWorkspaceData,
  FarmTeamInviteInput,
  IrrigationMethod,
  PlantingProgressInput,
  SoilType,
  UserProfile,
} from '../lib/app-types';
import { getMobilePlatformLabel, captureCropPhotoFromDevice, isNativeMobileApp } from '../lib/mobile';
import type { AppPreferences } from '../lib/preferences';
import { getAppCopy } from '../lib/preferences';
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
  summarizeAlerts,
  type WeatherSummary,
} from '../lib/weather';

type FarmerDashboardId = 'overview' | 'setup' | 'water' | 'operations' | 'support';

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

function getFarmName(profile: UserProfile) {
  if (profile.farmName?.trim()) {
    return profile.farmName.trim();
  }

  const firstName = profile.fullName.trim().split(' ')[0] || 'Farmer';
  return `${firstName}'s Farm`;
}

function FarmerWorkspaceNext({
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
  const [activeDashboard, setActiveDashboard] = useState<FarmerDashboardId>(
    workspace.plans.length ? 'overview' : 'setup',
  );
  const [setupStep, setSetupStep] = useState<SetupStepId>(workspace.plans.length ? 'board' : 'farm');
  const [profileForm, setProfileForm] = useState({
    fullName: workspace.profile.fullName,
    farmName: getFarmName(workspace.profile),
    country: workspace.profile.country,
    regionId: workspace.profile.regionId,
    soilType: workspace.profile.soilType ?? ('loam' as SoilType),
    irrigationMethod: workspace.profile.irrigationMethod ?? ('sprinkler' as IrrigationMethod),
  });
  const [selectedCropId, setSelectedCropId] = useState<CropPlanInput['cropId']>(
    workspace.plans[0]?.cropId ??
      regions.find((region) => region.id === workspace.profile.regionId)?.crops[0] ??
      'maize',
  );
  const [planForm, setPlanForm] = useState({
    varietyName: workspace.plans[0]?.varietyName ?? '',
    plantingDate: workspace.plans[0]?.plantingDate ?? new Date().toISOString().slice(0, 10),
    totalAreaHa: String(workspace.plans[0]?.totalAreaHa ?? ''),
  });
  const [progressForm, setProgressForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    areaHa: '',
  });
  const [teamInviteForm, setTeamInviteForm] = useState({
    label: '',
    teamRole: 'worker' as FarmTeamInviteInput['teamRole'],
  });
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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    getNotificationPermissionState,
  );

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
  const selectedTransaction =
    workspace.transactions.find((transaction) => transaction.cropId === selectedCropId) ?? null;
  const recommendedVarieties = useMemo(
    () => getVarieties(profileForm.regionId, profileForm.country, selectedCrop?.id),
    [profileForm.country, profileForm.regionId, selectedCrop?.id],
  );
  const selectedVariety =
    recommendedVarieties.find((variety) => variety.name === planForm.varietyName) ??
    recommendedVarieties[0] ??
    null;
  const currentIssue =
    selectedCrop?.issues.find((issue) => issue.id === issueId) ?? selectedCrop?.issues[0] ?? null;
  const currentAreaHa = Number(planForm.totalAreaHa || selectedPlan?.totalAreaHa || 0);
  const currentPlantingDate = selectedPlan?.plantingDate ?? planForm.plantingDate;
  const budget = selectedCrop
    ? buildBudgetSummary(selectedCrop.id, currentAreaHa, currentPlantingDate, weather)
    : null;
  const progressSummary = buildPlantingProgressSummary(selectedPlan, selectedEntries);
  const alerts = summarizeAlerts(selectedCrop, currentPlantingDate, weather);
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
  const nativeMobileApp = isNativeMobileApp();
  const mobilePlatformLabel = getMobilePlatformLabel();

  useEffect(() => {
    setProfileForm({
      fullName: workspace.profile.fullName,
      farmName: getFarmName(workspace.profile),
      country: workspace.profile.country,
      regionId: workspace.profile.regionId,
      soilType: workspace.profile.soilType ?? 'loam',
      irrigationMethod: workspace.profile.irrigationMethod ?? 'sprinkler',
    });
  }, [
    workspace.profile.country,
    workspace.profile.farmName,
    workspace.profile.fullName,
    workspace.profile.irrigationMethod,
    workspace.profile.regionId,
    workspace.profile.soilType,
  ]);

  useEffect(() => {
    if (!availableCrops.some((crop) => crop.id === selectedCropId)) {
      setSelectedCropId(availableCrops[0]?.id ?? 'maize');
    }
  }, [availableCrops, selectedCropId]);

  useEffect(() => {
    if (selectedPlan) {
      setPlanForm({
        varietyName: selectedPlan.varietyName ?? '',
        plantingDate: selectedPlan.plantingDate,
        totalAreaHa: String(selectedPlan.totalAreaHa),
      });
    }
  }, [selectedPlan?.cropId, selectedPlan?.plantingDate, selectedPlan?.totalAreaHa, selectedPlan?.varietyName]);

  useEffect(() => {
    if (!recommendedVarieties.length) {
      setPlanForm((current) => ({ ...current, varietyName: '' }));
      return;
    }

    if (!recommendedVarieties.some((entry) => entry.name === planForm.varietyName)) {
      setPlanForm((current) => ({ ...current, varietyName: recommendedVarieties[0].name }));
    }
  }, [planForm.varietyName, recommendedVarieties]);

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
    setSetupStep('crop');
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

    if (!planForm.varietyName) {
      setPlanningError('Choose a variety before saving the crop plan.');
      return;
    }

    setPlanningError('');
    await onSavePlan(workspace.profile, {
      cropId: selectedCrop.id,
      varietyName: planForm.varietyName,
      plantingDate: planForm.plantingDate,
      totalAreaHa,
    });
    setSetupStep('board');
    setActiveDashboard('overview');
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

  async function handleCapturePhoto() {
    setDiagnosisError('');
    try {
      const capture = await captureCropPhotoFromDevice();
      setPhotoFile(capture.file);
      setPhotoPreview(capture.previewUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the device camera right now.';
      if (!message.toLowerCase().includes('cancel')) {
        setDiagnosisError(message);
      }
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

  const dashboardItems: Array<{ id: FarmerDashboardId; label: string; detail: string }> = [
    { id: 'overview', label: 'Overview', detail: 'Farm snapshot and current season status.' },
    { id: 'setup', label: 'Setup', detail: 'Farm profile, crop, variety, and budget wizard.' },
    { id: 'water', label: 'Water', detail: 'Weather and irrigation planning.' },
    { id: 'operations', label: 'Operations', detail: 'Planting, finance, and harvest execution.' },
    { id: 'support', label: 'Support', detail: 'Agronomists, enquiries, and farm team tools.' },
  ];

  return (
    <main className="dashboard-grid">
      <section className={`card toolbar-card crop-hero crop-theme-${selectedCrop?.id ?? 'maize'}`}>
        <div className="toolbar-row">
          <div>
            <p className="section-kicker">Farmer workspace</p>
            <h2>{profileForm.farmName}</h2>
            <p className="muted">{workspace.profile.fullName} | {region.name}</p>
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
        <div className="hero-stat-grid top-gap">
          <div className="hero-stat"><span>Active crop</span><strong>{selectedCrop?.name ?? 'Choose crop'}</strong><small>{selectedVariety?.name ?? 'No variety selected yet'}</small></div>
          <div className="hero-stat"><span>Budgeted cost</span><strong>{budget ? formatUsd(budget.knownCostUsd) : 'US$0.00'}</strong><small>{currentAreaHa > 0 ? `${currentAreaHa.toFixed(1)} ha` : 'Enter hectares in setup'}</small></div>
          <div className="hero-stat"><span>Water setup</span><strong>{profileForm.irrigationMethod}</strong><small>{profileForm.soilType} soil</small></div>
        </div>
        {statusMessage ? <p className="muted top-gap">{statusMessage}</p> : null}
      </section>

      <ActionStrip reminders={reminders} subtitle={copy.todaySubtitle} title={copy.todayTitle} />

      <section className="card preferences-card workspace-nav-card">
        <div className="section-header compact-header">
          <div>
            <p className="section-kicker">Farmer dashboards</p>
            <h2>Move through the season without crowding one page</h2>
          </div>
          <span className="badge accent">{dashboardItems.find((item) => item.id === activeDashboard)?.label}</span>
        </div>
        <div className="workspace-nav-row">
          {dashboardItems.map((item) => (
            <button className={activeDashboard === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setActiveDashboard(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="muted">{dashboardItems.find((item) => item.id === activeDashboard)?.detail}</p>
      </section>

      {activeDashboard === 'overview' ? (
        <>
          <section className="card account-card">
            <div className="section-header">
              <div>
                <p className="section-kicker">Farm snapshot</p>
                <h2>What the app already knows</h2>
              </div>
              <span className="badge success">{selectedPlan ? 'Plan ready' : 'Setup needed'}</span>
            </div>
            <div className="metric-grid">
              <div className="metric-card"><span>Farm name</span><strong>{profileForm.farmName}</strong><small>{workspace.profile.fullName}</small></div>
              <div className="metric-card"><span>Available crops in {region.name}</span><strong>{availableCrops.length}</strong><small>{availableCrops.map((crop) => crop.name).join(' | ')}</small></div>
              <div className="metric-card"><span>Buyer board</span><strong>{selectedBoard?.name ?? 'Not linked yet'}</strong><small>{selectedPlan?.boardStatus ?? 'not-linked'}</small></div>
            </div>
          </section>

          <section className="card crop-card">
            <div className="section-header">
              <div>
                <p className="section-kicker">Current crop setup</p>
                <h2>Chosen crop and variety</h2>
              </div>
              <span className="badge accent">{selectedCrop?.name ?? 'No crop'}</span>
            </div>
            <p className="muted">{selectedCrop?.summary ?? 'Open Setup and choose the first crop for this farm.'}</p>
            <div className="stack-list">
              <li><strong>Variety</strong><span>{selectedPlan?.varietyName ?? selectedVariety?.name ?? 'Still to be selected'}</span></li>
              <li><strong>Planned hectares</strong><span>{selectedPlan ? `${selectedPlan.totalAreaHa.toFixed(1)} ha` : 'Enter hectares in Setup'}</span></li>
              <li><strong>Irrigation method</strong><span>{profileForm.irrigationMethod}</span></li>
            </div>
          </section>

          <section className="card progress-card">
            <div className="section-header">
              <div>
                <p className="section-kicker">Planting progress</p>
                <h2>Field completion</h2>
              </div>
              <span className="badge accent">{progressSummary.completionPercent.toFixed(0)}%</span>
            </div>
            <div className="progress-bar-shell" aria-label="Planting completion">
              <div className="progress-bar-fill" style={{ width: `${progressSummary.completionPercent}%` }} />
            </div>
            <p className="muted">{progressSummary.plantedAreaHa.toFixed(1)} ha planted | {progressSummary.remainingAreaHa.toFixed(1)} ha remaining</p>
          </section>

          {selectedCrop ? (
            <FieldMapPanel
              cropName={selectedCrop.name}
              pins={workspace.enquiries.filter((entry) => entry.cropId === selectedCrop.id).slice(0, 3).map((entry) => ({
                label: selectedCrop.issues.find((issue) => issue.id === entry.issueId)?.title ?? 'Field enquiry',
                detail: entry.note,
              }))}
              plantedAreaHa={progressSummary.plantedAreaHa}
              regionName={region.name}
              remainingAreaHa={progressSummary.remainingAreaHa}
              totalAreaHa={progressSummary.totalAreaHa}
            />
          ) : null}

          <SeasonOutlookPanel
            country={workspace.profile.country}
            currentCropId={selectedCrop?.id ?? null}
            defaultAreaHa={currentAreaHa || 1}
            regionId={region.id}
            weather={weather}
          />
        </>
      ) : null}

      {activeDashboard === 'setup' ? (
        <FarmerSetupDashboard
          availableCrops={availableCrops}
          boardLinkForm={boardLinkForm}
          budget={budget}
          busy={busy}
          currentAreaHa={currentAreaHa}
          onLinkBoard={handleBoardLink}
          onOpenDashboard={setActiveDashboard}
          onSavePlan={handlePlanSave}
          onSaveProfile={handleProfileSave}
          planningError={planningError}
          planForm={planForm}
          profile={workspace.profile}
          profileForm={profileForm}
          recommendedVarieties={recommendedVarieties}
          regionName={region.name}
          selectedBoard={selectedBoard}
          selectedCrop={selectedCrop}
          selectedCropId={selectedCropId}
          selectedPlan={selectedPlan ? { boardStatus: selectedPlan.boardStatus, growerId: selectedPlan.growerId } : null}
          selectedVariety={selectedVariety}
          setBoardLinkForm={setBoardLinkForm}
          setPlanForm={setPlanForm}
          setProfileForm={setProfileForm}
          setSelectedCropId={setSelectedCropId}
          setSetupStep={setSetupStep}
          setupStep={setupStep}
        />
      ) : null}

      {activeDashboard === 'water' ? (
        <FarmerWaterDashboard
          alerts={alerts}
          currentAreaHa={currentAreaHa}
          currentPlantingDate={currentPlantingDate}
          irrigationMethod={profileForm.irrigationMethod}
          selectedCrop={selectedCrop}
          soilType={profileForm.soilType}
          weather={weather}
          weatherError={weatherError}
          weatherLoading={weatherLoading}
        />
      ) : null}

      {activeDashboard === 'operations' ? (
        <>
          <section className="card progress-card">
            <div className="section-header">
              <div>
                <p className="section-kicker">Planting records</p>
                <h2>Track planting until the farm is complete</h2>
              </div>
              <span className="badge accent">{progressSummary.status}</span>
            </div>
            <form className="form-grid compact" onSubmit={handlePlantingSave}>
              <label>
                Date planted
                <input required type="date" value={progressForm.entryDate} onChange={(event) => setProgressForm((current) => ({ ...current, entryDate: event.target.value }))} />
              </label>
              <label>
                Hectares planted that day
                <input min="0.1" required step="0.1" type="number" value={progressForm.areaHa} onChange={(event) => setProgressForm((current) => ({ ...current, areaHa: event.target.value }))} />
              </label>
              <button className="secondary-button" disabled={busy || !selectedPlan} type="submit">Save daily record</button>
            </form>
            {progressError ? <p className="muted">{progressError}</p> : null}
          </section>

          {selectedCrop ? (
            <section className="workspace-cluster subcard-grid">
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
                totalAreaHa={currentAreaHa}
                transaction={selectedTransaction}
              />
            </section>
          ) : null}

          <section className="workspace-cluster subcard-grid">
            <FarmerOperationsDesk
              budget={budget}
              enquiries={workspace.enquiries}
              plantingEntries={workspace.plantingEntries}
              plans={workspace.plans}
              preferences={preferences}
              profile={workspace.profile}
              selectedCropId={selectedCropId}
            />
          </section>
        </>
      ) : null}

      {activeDashboard === 'support' ? (
        <FarmerSupportDashboard
          agronomistMatches={agronomistMatches}
          busy={busy}
          currentIssue={currentIssue}
          diagnosis={diagnosis}
          diagnosisBusy={diagnosisBusy}
          diagnosisError={diagnosisError}
          enquiries={workspace.enquiries}
          enquiryNote={enquiryNote}
          farmerName={workspace.profile.fullName}
          issueId={issueId}
          mobilePlatformLabel={mobilePlatformLabel}
          nativeMobileApp={nativeMobileApp}
          onCapturePhoto={handleCapturePhoto}
          onRunDiagnosis={handleRunDiagnosis}
          onSaveTeamInvite={handleTeamInviteSave}
          onSubmitEnquiry={handleEnquirySubmit}
          photoChange={handlePhotoChange}
          photoPreview={photoPreview}
          regionName={region.name}
          selectedCrop={selectedCrop}
          setEnquiryNote={setEnquiryNote}
          setIssueId={setIssueId}
          setTeamInviteForm={setTeamInviteForm}
          teamInviteForm={teamInviteForm}
          teamInvites={workspace.teamInvites}
          teamMembers={workspace.teamMembers}
        />
      ) : null}
    </main>
  );
}

export default FarmerWorkspaceNext;
