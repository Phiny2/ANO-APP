import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { crops, regions } from '../data';
import ActionStrip from './ActionStrip';
import FieldMapPanel from './FieldMapPanel';
import { buildPlantingProgressSummary } from '../lib/economics';
import type {
  BackendStatus,
  PlantingProgressInput,
  StaffWorkspace as StaffWorkspaceData,
  UserProfile,
} from '../lib/app-types';
import { buildFarmReminders } from '../lib/reminders';
import {
  buildWeatherFallback,
  fetchWeather,
  formatDate,
  getLocalIsoDate,
  summarizeAlerts,
  type WeatherSummary,
} from '../lib/weather';

interface StaffWorkspaceProps {
  backend: BackendStatus;
  busy: boolean;
  workspace: StaffWorkspaceData;
  statusMessage: string;
  onRefresh: () => Promise<void>;
  onSavePlantingRecord: (profile: UserProfile, input: PlantingProgressInput) => Promise<void>;
  onSignOut: () => Promise<void>;
}

function canRecordPlanting(teamRole: StaffWorkspaceData['membership']['teamRole']) {
  return teamRole === 'manager' || teamRole === 'worker';
}

function StaffWorkspace({
  backend,
  busy,
  workspace,
  statusMessage,
  onRefresh,
  onSavePlantingRecord,
  onSignOut,
}: StaffWorkspaceProps) {
  const [selectedCropId, setSelectedCropId] = useState(workspace.plans[0]?.cropId ?? 'maize');
  const [progressForm, setProgressForm] = useState({
    entryDate: getLocalIsoDate(),
    areaHa: '',
  });
  const [progressError, setProgressError] = useState('');
  const [weather, setWeather] = useState<WeatherSummary | null>(null);

  const region = regions.find((entry) => entry.id === workspace.farmer.regionId) ?? regions[0];
  const selectedCrop = crops.find((crop) => crop.id === selectedCropId) ?? null;
  const selectedPlan = workspace.plans.find((plan) => plan.cropId === selectedCropId) ?? null;
  const selectedEntries = useMemo(
    () =>
      workspace.plantingEntries
        .filter((entry) => entry.cropId === selectedCropId)
        .sort((left, right) => right.entryDate.localeCompare(left.entryDate)),
    [selectedCropId, workspace.plantingEntries],
  );
  const selectedTransaction = workspace.transactions.find((transaction) => transaction.cropId === selectedCropId) ?? null;
  const progressSummary = buildPlantingProgressSummary(selectedPlan, selectedEntries);
  const alerts = summarizeAlerts(selectedCrop, selectedPlan?.plantingDate ?? getLocalIsoDate(), weather);
  const reminders = buildFarmReminders({
    crop: selectedCrop,
    plan: selectedPlan,
    transaction: selectedTransaction,
    progressSummary,
    weather,
    alerts,
  });

  useEffect(() => {
    if (!workspace.plans.some((plan) => plan.cropId === selectedCropId)) {
      setSelectedCropId(workspace.plans[0]?.cropId ?? 'maize');
    }
  }, [selectedCropId, workspace.plans]);

  useEffect(() => {
    let cancelled = false;
    fetchWeather(region.id, region.coordinates.lat, region.coordinates.lon)
      .then((result) => {
        if (!cancelled) {
          setWeather(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWeather(buildWeatherFallback(region.id, region.coordinates.lat, region.coordinates.lon));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [region.coordinates.lat, region.coordinates.lon, region.id]);

  async function handlePlantingSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCrop || !selectedPlan) {
      setProgressError('This farm still needs a crop plan before planting records can be captured.');
      return;
    }

    const areaHa = Number(progressForm.areaHa);
    if (!Number.isFinite(areaHa) || areaHa <= 0) {
      setProgressError('Enter the hectares completed on that shift or day.');
      return;
    }

    if (progressSummary.remainingAreaHa > 0 && areaHa - progressSummary.remainingAreaHa > 0.001) {
      setProgressError('That entry is larger than the remaining planned area.');
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

  return (
    <main className="dashboard-grid staff-mode">
      <section className="card toolbar-card">
        <div className="toolbar-row">
          <div>
            <p className="section-kicker">Farm team workspace</p>
            <h2>{workspace.profile.fullName}</h2>
            <p className="muted">
              {workspace.membership.teamRole} for {workspace.farmer.fullName}
            </p>
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

      <ActionStrip
        reminders={reminders}
        subtitle="Assigned farm actions for this shift or day."
        title="Today on the assigned farm"
      />

      <section className="card crop-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Assigned crops</p>
            <h2>{workspace.farmer.fullName}'s crop plans</h2>
          </div>
          <span className="badge accent">{workspace.membership.teamRole}</span>
        </div>
        <div className="saved-plan-row">
          {workspace.plans.map((plan) => (
            <button
              className={`plan-chip ${plan.cropId === selectedCropId ? 'selected' : ''}`}
              key={plan.id}
              type="button"
              onClick={() => setSelectedCropId(plan.cropId)}
            >
              {crops.find((crop) => crop.id === plan.cropId)?.name} | {plan.totalAreaHa} ha
            </button>
          ))}
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <span>Current crop</span>
            <strong>{selectedCrop?.name ?? 'No plan'}</strong>
          </div>
          <div className="metric-card">
            <span>Planted to date</span>
            <strong>{progressSummary.plantedAreaHa.toFixed(1)} ha</strong>
          </div>
          <div className="metric-card">
            <span>Remaining</span>
            <strong>{progressSummary.remainingAreaHa.toFixed(1)} ha</strong>
          </div>
        </div>
      </section>

      <section className="card weather-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Field capture</p>
            <h2>Daily progress entry</h2>
          </div>
        </div>
        {canRecordPlanting(workspace.membership.teamRole) ? (
          <form className="form-grid compact" onSubmit={handlePlantingSave}>
            <label>
              Date worked
              <input
                required
                type="date"
                value={progressForm.entryDate}
                onChange={(event) => setProgressForm((current) => ({ ...current, entryDate: event.target.value }))}
              />
            </label>
            <label>
              Hectares completed
              <input
                min="0.1"
                required
                step="0.1"
                type="number"
                value={progressForm.areaHa}
                onChange={(event) => setProgressForm((current) => ({ ...current, areaHa: event.target.value }))}
              />
            </label>
            <button className="primary-button" disabled={busy || !selectedPlan} type="submit">
              Save progress
            </button>
          </form>
        ) : (
          <p className="muted">This staff role is set up for scouting and visibility, not planting updates.</p>
        )}
        {progressError ? <p className="muted">{progressError}</p> : null}

        <div className="table-shell top-gap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Area</th>
                <th>Status</th>
              </tr>
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
      </section>

      {selectedCrop ? (
        <FieldMapPanel
          cropName={selectedCrop.name}
          pins={workspace.enquiries
            .filter((entry) => entry.cropId === selectedCrop.id)
            .slice(0, 3)
            .map((entry) => ({
              label: selectedCrop.issues.find((issue) => issue.id === entry.issueId)?.title ?? 'Field note',
              detail: entry.note,
            }))}
          plantedAreaHa={progressSummary.plantedAreaHa}
          regionName={region.name}
          remainingAreaHa={progressSummary.remainingAreaHa}
          totalAreaHa={progressSummary.totalAreaHa}
        />
      ) : null}
    </main>
  );
}

export default StaffWorkspace;
