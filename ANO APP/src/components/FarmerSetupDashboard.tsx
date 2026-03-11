import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { regions, type CropGuide } from '../data';
import { formatUsd, type BudgetSummary } from '../lib/economics';
import type {
  BoardLinkInput,
  CropPlanInput,
  IrrigationMethod,
  SoilType,
  UserProfile,
} from '../lib/app-types';
import { formatDate } from '../lib/weather';

export type SetupStepId = 'farm' | 'crop' | 'variety' | 'budget' | 'board';

interface FarmerSetupDashboardProps {
  busy: boolean;
  profile: UserProfile;
  profileForm: {
    fullName: string;
    farmName: string;
    country: UserProfile['country'];
    regionId: string;
    soilType: SoilType;
    irrigationMethod: IrrigationMethod;
  };
  setProfileForm: Dispatch<
    SetStateAction<{
      fullName: string;
      farmName: string;
      country: UserProfile['country'];
      regionId: string;
      soilType: SoilType;
      irrigationMethod: IrrigationMethod;
    }>
  >;
  availableCrops: CropGuide[];
  regionName: string;
  selectedCropId: CropPlanInput['cropId'];
  setSelectedCropId: Dispatch<SetStateAction<CropPlanInput['cropId']>>;
  selectedCrop: CropGuide | null;
  setupStep: SetupStepId;
  setSetupStep: Dispatch<SetStateAction<SetupStepId>>;
  planForm: {
    varietyName: string;
    plantingDate: string;
    totalAreaHa: string;
  };
  setPlanForm: Dispatch<
    SetStateAction<{
      varietyName: string;
      plantingDate: string;
      totalAreaHa: string;
    }>
  >;
  recommendedVarieties: Array<{ name: string; fit: string }>;
  selectedVariety: { name: string; fit: string } | null;
  selectedPlan: {
    boardStatus: string;
    growerId?: string;
  } | null;
  selectedBoard:
    | {
        name: string;
        farmerPrompt: string;
        growerIdLabel: string;
      }
    | undefined;
  boardLinkForm: {
    growerId: string;
    pin: string;
  };
  setBoardLinkForm: Dispatch<
    SetStateAction<{
      growerId: string;
      pin: string;
    }>
  >;
  budget: BudgetSummary | null;
  currentAreaHa: number;
  planningError: string;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSavePlan: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLinkBoard: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenDashboard: (dashboard: 'overview' | 'water' | 'operations' | 'support') => void;
}

function setupStepIndex(step: SetupStepId) {
  return ['farm', 'crop', 'variety', 'budget', 'board'].indexOf(step) + 1;
}

function nextSetupStep(step: SetupStepId): SetupStepId {
  switch (step) {
    case 'farm':
      return 'crop';
    case 'crop':
      return 'variety';
    case 'variety':
      return 'budget';
    case 'budget':
      return 'board';
    default:
      return 'board';
  }
}

function previousSetupStep(step: SetupStepId): SetupStepId {
  switch (step) {
    case 'board':
      return 'budget';
    case 'budget':
      return 'variety';
    case 'variety':
      return 'crop';
    case 'crop':
      return 'farm';
    default:
      return 'farm';
  }
}

function FarmerSetupDashboard({
  busy,
  profileForm,
  setProfileForm,
  availableCrops,
  regionName,
  selectedCropId,
  setSelectedCropId,
  selectedCrop,
  setupStep,
  setSetupStep,
  planForm,
  setPlanForm,
  recommendedVarieties,
  selectedVariety,
  selectedPlan,
  selectedBoard,
  boardLinkForm,
  setBoardLinkForm,
  budget,
  currentAreaHa,
  planningError,
  onSaveProfile,
  onSavePlan,
  onLinkBoard,
  onOpenDashboard,
}: FarmerSetupDashboardProps) {
  return (
    <section className="card advisory-card">
      <div className="section-header">
        <div>
          <p className="section-kicker">Farm setup wizard</p>
          <h2>Guide the farmer from account to ready-to-plant budget</h2>
        </div>
        <span className="badge accent">Step {setupStepIndex(setupStep)} of 5</span>
      </div>

      <div className="wizard-step-row">
        {(['farm', 'crop', 'variety', 'budget', 'board'] as SetupStepId[]).map((step) => (
          <button
            className={setupStep === step ? 'active' : ''}
            key={step}
            type="button"
            onClick={() => setSetupStep(step)}
          >
            {step === 'farm'
              ? 'Farm'
              : step === 'crop'
                ? 'Crop'
                : step === 'variety'
                  ? 'Variety'
                  : step === 'budget'
                    ? 'Budget'
                    : 'Board'}
          </button>
        ))}
      </div>

      {setupStep === 'farm' ? (
        <div className="split-grid top-gap">
          <article className="subcard">
            <h3>Farm identity</h3>
            <p className="muted">This becomes the base profile for crops, budgets, and irrigation planning.</p>
            <form className="form-grid compact" onSubmit={onSaveProfile}>
              <label>
                Full name
                <input
                  required
                  type="text"
                  value={profileForm.fullName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                />
              </label>
              <label>
                Farm name
                <input
                  required
                  type="text"
                  value={profileForm.farmName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, farmName: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, regionId: event.target.value }))
                  }
                >
                  {regions
                    .filter((entry) => entry.country === profileForm.country)
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Soil type
                <select
                  value={profileForm.soilType}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      soilType: event.target.value as SoilType,
                    }))
                  }
                >
                  <option value="sandy">Sandy</option>
                  <option value="loam">Loam</option>
                  <option value="clay">Clay</option>
                </select>
              </label>
              <label>
                Irrigation method
                <select
                  value={profileForm.irrigationMethod}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      irrigationMethod: event.target.value as IrrigationMethod,
                    }))
                  }
                >
                  <option value="sprinkler">Sprinkler</option>
                  <option value="drip">Drip</option>
                  <option value="pivot">Pivot</option>
                  <option value="furrow">Furrow</option>
                  <option value="rainfed">Rainfed</option>
                </select>
              </label>
              <button className="primary-button" disabled={busy} type="submit">
                Save farm profile and continue
              </button>
            </form>
          </article>

          <article className="subcard">
            <h3>Region crop access</h3>
            <p className="muted">Only the crops supported in the selected region are listed below.</p>
            <div className="stack-list">
              {availableCrops.map((crop) => (
                <li key={crop.id}>
                  <strong>{crop.name}</strong>
                  <span>{crop.summary}</span>
                </li>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {setupStep === 'crop' ? (
        <article className="subcard top-gap">
          <div className="section-header compact-header">
            <div>
              <h3>Select the crop for this season</h3>
              <p className="muted">The farmer only sees crops supported in {regionName}.</p>
            </div>
            <span className="badge accent">{availableCrops.length} available</span>
          </div>
          <div className="crop-grid">
            {availableCrops.map((crop) => (
              <button
                className={`crop-tile ${selectedCropId === crop.id ? 'selected' : ''}`}
                key={crop.id}
                type="button"
                onClick={() => {
                  setSelectedCropId(crop.id);
                  setSetupStep('variety');
                }}
              >
                <span className="crop-icon">{crop.icon}</span>
                <strong>{crop.name}</strong>
                <p>{crop.summary}</p>
              </button>
            ))}
          </div>
        </article>
      ) : null}

      {setupStep === 'variety' ? (
        <article className="subcard top-gap">
          <div className="section-header compact-header">
            <div>
              <h3>Choose the variety</h3>
              <p className="muted">Varieties are filtered by country and region.</p>
            </div>
            <span className="badge accent">{selectedCrop?.name ?? 'Select crop first'}</span>
          </div>
          {recommendedVarieties.length ? (
            <div className="service-grid">
              {recommendedVarieties.map((variety) => (
                <button
                  className={`service-card variety-card ${planForm.varietyName === variety.name ? 'selected' : ''}`}
                  key={variety.name}
                  type="button"
                  onClick={() => {
                    setPlanForm((current) => ({ ...current, varietyName: variety.name }));
                    setSetupStep('budget');
                  }}
                >
                  <span className={`badge ${planForm.varietyName === variety.name ? 'success' : 'neutral'}`}>
                    {planForm.varietyName === variety.name ? 'Selected' : 'Available'}
                  </span>
                  <strong>{variety.name}</strong>
                  <p>{variety.fit}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No exact varieties are loaded for this crop and region yet.</p>
          )}
        </article>
      ) : null}

      {setupStep === 'budget' ? (
        <div className="split-grid top-gap">
          <article className="subcard">
            <div className="section-header compact-header">
              <div>
                <h3>Hectares and planting window</h3>
                <p className="muted">Enter the farmer's target area and let the app budget before they proceed.</p>
              </div>
              {selectedVariety ? <span className="badge success">{selectedVariety.name}</span> : null}
            </div>
            <form className="form-grid compact" onSubmit={onSavePlan}>
              <label>
                Planting date
                <input
                  required
                  type="date"
                  value={planForm.plantingDate}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, plantingDate: event.target.value }))
                  }
                />
              </label>
              <label>
                Hectares to plant
                <input
                  min="0.1"
                  required
                  step="0.1"
                  type="number"
                  value={planForm.totalAreaHa}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, totalAreaHa: event.target.value }))
                  }
                />
              </label>
              <button className="primary-button" disabled={busy} type="submit">
                Save crop plan and open dashboards
              </button>
            </form>
            {planningError ? <p className="muted">{planningError}</p> : null}
            {selectedVariety ? (
              <div className="notice-callout">
                <strong>{selectedVariety.name}</strong>
                <span>{selectedVariety.fit}</span>
              </div>
            ) : null}
          </article>

          <article className="subcard budget-card">
            <div className="section-header compact-header">
              <div>
                <h3>Pre-planting budget preview</h3>
                <p className="muted">Rough estimate before the farmer proceeds.</p>
              </div>
              {budget ? <span className="badge accent">{formatUsd(budget.knownCostUsd)}</span> : null}
            </div>
            {budget ? (
              <>
                <div className="metric-grid business-metric-grid">
                  <div className="metric-card compact-metric">
                    <span>Seed or planting material</span>
                    <strong>{budget.seedSummary?.packsNeeded ?? 0}</strong>
                    <small>{budget.seedSummary?.packLabel ?? 'Quote item'}</small>
                  </div>
                  <div className="metric-card compact-metric">
                    <span>Known cost / ha</span>
                    <strong>{currentAreaHa > 0 ? formatUsd(budget.knownCostUsd / currentAreaHa) : 'US$0.00'}</strong>
                    <small>Based on listed store prices</small>
                  </div>
                  <div className="metric-card compact-metric">
                    <span>Total estimated known cost</span>
                    <strong>{formatUsd(budget.knownCostUsd)}</strong>
                    <small>{currentAreaHa.toFixed(1)} ha</small>
                  </div>
                </div>
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Product</th>
                        <th>Need</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.stageLines.slice(0, 6).map((line) => (
                        <tr key={line.id}>
                          <td>{line.title}<div className="table-subtext">{formatDate(line.plannedDate)}</div></td>
                          <td>{line.productName}</td>
                          <td>{line.quantityLabel}</td>
                          <td>{formatUsd(line.stageCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="muted">Enter hectares and keep a crop selected to generate the preview budget.</p>
            )}
          </article>
        </div>
      ) : null}

      {setupStep === 'board' ? (
        <div className="split-grid top-gap">
          <article className="subcard">
            <div className="section-header compact-header">
              <div>
                <h3>Buyer board link</h3>
                <p className="muted">After the plan is saved, link the farmer to the right board if verification is needed.</p>
              </div>
              {selectedPlan ? (
                <span className={`badge ${selectedPlan.boardStatus === 'verified' ? 'success' : selectedPlan.boardStatus === 'linked' ? 'warning' : 'neutral'}`}>
                  {selectedPlan.boardStatus}
                </span>
              ) : null}
            </div>
            {selectedBoard && selectedCrop ? (
              <>
                <p className="muted">
                  {selectedPlan?.boardStatus === 'verified'
                    ? `${selectedBoard.name} already recognizes this farmer record for ${selectedCrop.name}.`
                    : selectedBoard.farmerPrompt}
                </p>
                {selectedPlan?.boardStatus !== 'verified' ? (
                  <form className="form-grid compact" onSubmit={onLinkBoard}>
                    <label>
                      {selectedBoard.growerIdLabel}
                      <input
                        required
                        type="text"
                        value={boardLinkForm.growerId}
                        onChange={(event) =>
                          setBoardLinkForm((current) => ({ ...current, growerId: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Board PIN
                      <input
                        required
                        type="password"
                        value={boardLinkForm.pin}
                        onChange={(event) =>
                          setBoardLinkForm((current) => ({ ...current, pin: event.target.value }))
                        }
                      />
                    </label>
                    <button className="secondary-button" disabled={busy || !selectedPlan} type="submit">
                      Link board record
                    </button>
                  </form>
                ) : (
                  <div className="confirmation">
                    Grower ID: <strong>{selectedPlan.growerId ?? 'Verified'}</strong>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">Select a crop to continue with board linkage.</p>
            )}
          </article>

          <article className="subcard">
            <h3>What the farmer gets next</h3>
            <div className="workflow-list">
              <div className="workflow-item ready">
                <div>
                  <strong>Water dashboard</strong>
                  <p>Weather-aware irrigation sessions for the next two weeks.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => onOpenDashboard('water')}>
                  Open
                </button>
              </div>
              <div className="workflow-item ready">
                <div>
                  <strong>Operations dashboard</strong>
                  <p>Planting records, business planning, marketplace, and harvest logging.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => onOpenDashboard('operations')}>
                  Open
                </button>
              </div>
              <div className="workflow-item ready">
                <div>
                  <strong>Support dashboard</strong>
                  <p>Agronomists, live camera diagnosis, and farm team access.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => onOpenDashboard('support')}>
                  Open
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      <div className="toolbar-actions top-gap">
        <button
          className="secondary-button"
          disabled={setupStep === 'farm'}
          type="button"
          onClick={() => setSetupStep(previousSetupStep(setupStep))}
        >
          Back
        </button>
        <button
          className="secondary-button"
          disabled={setupStep === 'board'}
          type="button"
          onClick={() => setSetupStep(nextSetupStep(setupStep))}
        >
          Next
        </button>
      </div>
    </section>
  );
}

export default FarmerSetupDashboard;
