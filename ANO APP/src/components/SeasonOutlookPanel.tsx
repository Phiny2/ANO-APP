import { useEffect, useMemo, useState } from 'react';
import { formatUsd } from '../lib/economics';
import { buildSeasonOutlook } from '../lib/season-planner';
import { formatDate, type WeatherSummary } from '../lib/weather';
import type { CropPlanInput, UserProfile } from '../lib/app-types';

interface SeasonOutlookPanelProps {
  country: UserProfile['country'];
  regionId: string;
  currentCropId: CropPlanInput['cropId'] | null;
  defaultAreaHa: number;
  weather: WeatherSummary | null;
}

function SeasonOutlookPanel({
  country,
  regionId,
  currentCropId,
  defaultAreaHa,
  weather,
}: SeasonOutlookPanelProps) {
  const [targetAreaHa, setTargetAreaHa] = useState(String(defaultAreaHa > 0 ? defaultAreaHa : 1));

  useEffect(() => {
    setTargetAreaHa(String(defaultAreaHa > 0 ? defaultAreaHa : 1));
  }, [defaultAreaHa]);

  const safeArea = Math.max(Number(targetAreaHa || 0), 0.1);
  const outlook = useMemo(
    () =>
      buildSeasonOutlook({
        country,
        regionId,
        currentCropId,
        targetAreaHa: safeArea,
        weather,
      }),
    [country, currentCropId, regionId, safeArea, weather],
  );

  return (
    <article className="subcard">
      <div className="section-header compact-header">
        <div>
          <h3>Next season outlook</h3>
          <p className="muted">
            The app ranks the next production window for this region and shows expected total cost per hectare before planting.
          </p>
        </div>
        <span className="badge accent">Forecast</span>
      </div>

      <form className="form-grid compact">
        <label>
          Area to compare for next season (ha)
          <input
            min="0.1"
            step="0.1"
            type="number"
            value={targetAreaHa}
            onChange={(event) => setTargetAreaHa(event.target.value)}
          />
        </label>
      </form>

      <div className="service-grid top-gap">
        {outlook.slice(0, 3).map((option, index) => (
          <article className="service-card season-card" key={`${option.cropId}-${option.seasonLabel}`}>
            <span className={`badge ${index === 0 ? 'success' : 'neutral'}`}>{index === 0 ? 'Recommended' : 'Option'}</span>
            <strong>{option.cropName}</strong>
            <p>
              {option.seasonLabel} | plant around {formatDate(option.suggestedPlantingDate)}
            </p>
            <small>{option.reason}</small>
            <div className="metric-grid compact-season-grid">
              <div className="metric-card compact-metric">
                <span>Input cost / ha</span>
                <strong>{formatUsd(option.estimatedInputCostPerHaUsd)}</strong>
              </div>
              <div className="metric-card compact-metric">
                <span>Total cost / ha</span>
                <strong>{formatUsd(option.estimatedTotalCostPerHaUsd)}</strong>
              </div>
              <div className="metric-card compact-metric">
                <span>Total cost for {safeArea.toFixed(1)} ha</span>
                <strong>{formatUsd(option.estimatedTotalCostUsd)}</strong>
              </div>
            </div>
            <small>
              Target yield {option.expectedYieldPerHa.toFixed(option.yieldUnit === 'kg' ? 0 : 2)} {option.yieldUnit}/ha
            </small>
            <small>
              Margin / ha {option.expectedMarginPerHaUsd === null ? 'Contract quote needed' : formatUsd(option.expectedMarginPerHaUsd)}
            </small>
            {option.varieties.length ? (
              <small>Varieties: {option.varieties.slice(0, 3).join(', ')}</small>
            ) : null}
            {option.caution ? <small>{option.caution}</small> : null}
          </article>
        ))}
      </div>
    </article>
  );
}

export default SeasonOutlookPanel;
