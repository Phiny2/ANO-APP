import type { IrrigationMethod, SoilType } from '../lib/app-types';
import { buildIrrigationPlan, formatDurationHours } from '../lib/irrigation';
import { formatDate, getWeatherAdvice, type WeatherSummary } from '../lib/weather';
import type { CropGuide } from '../data';

interface IrrigationPlannerPanelProps {
  crop: CropGuide | null;
  weather: WeatherSummary | null;
  plantingDate: string;
  totalAreaHa: number;
  soilType: SoilType;
  irrigationMethod: IrrigationMethod;
}

function IrrigationPlannerPanel({
  crop,
  weather,
  plantingDate,
  totalAreaHa,
  soilType,
  irrigationMethod,
}: IrrigationPlannerPanelProps) {
  const irrigationPlan = buildIrrigationPlan({
    crop,
    weather,
    plantingDate,
    totalAreaHa,
    soilType,
    irrigationMethod,
  });

  if (!crop) {
    return (
      <article className="subcard">
        <h3>Irrigation planner</h3>
        <p className="muted">Choose a crop and save the setup first so the water plan can be generated.</p>
      </article>
    );
  }

  return (
    <article className="subcard water-plan-card">
      <div className="section-header compact-header">
        <div>
          <h3>Irrigation planner</h3>
          <p className="muted">2-week schedule linked to rainfall outlook, soil, crop stage, and irrigation method.</p>
        </div>
        <span className="badge accent">{irrigationMethod}</span>
      </div>

      <div className="metric-grid business-metric-grid">
        <div className="metric-card compact-metric">
          <span>Soil type</span>
          <strong>{soilType}</strong>
          <small>{crop.name}</small>
        </div>
        <div className="metric-card compact-metric">
          <span>Farm area under plan</span>
          <strong>{totalAreaHa.toFixed(1)} ha</strong>
          <small>Planting date {formatDate(plantingDate)}</small>
        </div>
        <div className="metric-card compact-metric">
          <span>Current water stage</span>
          <strong>{irrigationPlan?.stageLabel ?? 'Waiting'}</strong>
          <small>{weather ? getWeatherAdvice(weather, crop) : 'Weather forecast not loaded yet.'}</small>
        </div>
      </div>

      {irrigationPlan ? (
        <>
          <div className="notice-callout">
            <strong>{irrigationPlan.summary}</strong>
            <span>{irrigationPlan.nextAction}</span>
          </div>

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Water target</th>
                  <th>Duration</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {irrigationPlan.sessions.map((session) => (
                  <tr key={`${session.date}-${session.action}`}>
                    <td>{formatDate(session.date)}</td>
                    <td>
                      <span className={`badge ${session.action === 'irrigate' ? 'success' : session.action === 'delay' ? 'warning' : 'neutral'}`}>
                        {session.action}
                      </span>
                    </td>
                    <td>{session.waterMm > 0 ? `${session.waterMm} mm` : 'Monitor only'}</td>
                    <td>{session.durationHours > 0 ? formatDurationHours(session.durationHours) : '-'}</td>
                    <td>{session.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="muted">Weather data is still loading, so the irrigation planner is waiting for the forecast.</p>
      )}
    </article>
  );
}

export default IrrigationPlannerPanel;
