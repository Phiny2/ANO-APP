import type { CropGuide } from '../data';
import IrrigationPlannerPanel from './IrrigationPlannerPanel';
import type { IrrigationMethod, SoilType } from '../lib/app-types';
import { formatDate, getWeatherAdvice, type WeatherSummary } from '../lib/weather';

interface FarmerWaterDashboardProps {
  selectedCrop: CropGuide | null;
  currentPlantingDate: string;
  currentAreaHa: number;
  irrigationMethod: IrrigationMethod;
  soilType: SoilType;
  weather: WeatherSummary | null;
  weatherLoading: boolean;
  weatherError: string;
  alerts: string[];
}

function FarmerWaterDashboard({
  selectedCrop,
  currentPlantingDate,
  currentAreaHa,
  irrigationMethod,
  soilType,
  weather,
  weatherLoading,
  weatherError,
  alerts,
}: FarmerWaterDashboardProps) {
  return (
    <>
      <section className="card weather-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Weather</p>
            <h2>Forecast and moisture alerts</h2>
          </div>
          {weather ? (
            <span className="badge">
              {weather.source === 'live' ? 'Live forecast' : 'Fallback forecast'}
            </span>
          ) : null}
        </div>
        {weatherLoading ? (
          <p className="muted">Loading regional weather forecast...</p>
        ) : (
          <>
            {weather ? (
              <div className="weather-layout">
                <div className="weather-stat">
                  <span>Today</span>
                  <strong>{weather.todayMaxTemp} C</strong>
                  <small>{weather.todayRainChance}% rain chance</small>
                </div>
                <div className="weather-stat">
                  <span>Tomorrow</span>
                  <strong>{weather.tomorrowRainMm} mm</strong>
                  <small>{weather.tomorrowRainChance}% chance of rain</small>
                </div>
                <div className="weather-advice">
                  <p>{getWeatherAdvice(weather, selectedCrop)}</p>
                </div>
              </div>
            ) : null}
            {weather ? (
              <div className="forecast-ribbon">
                {weather.forecastDays.slice(0, 7).map((day) => (
                  <article className="forecast-day-card" key={day.date}>
                    <strong>{formatDate(day.date)}</strong>
                    <span>{day.maxTemp} C</span>
                    <small>{day.rainChance}% rain</small>
                    <small>{day.rainMm} mm</small>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        )}
        {weatherError ? <p className="muted">{weatherError}</p> : null}
        <div className="alert-list">
          {alerts.length ? (
            alerts.map((alert) => <div className="alert-pill" key={alert}>{alert}</div>)
          ) : (
            <p className="muted">Save a crop plan to generate weather-linked field alerts.</p>
          )}
        </div>
      </section>

      <IrrigationPlannerPanel
        crop={selectedCrop}
        irrigationMethod={irrigationMethod}
        plantingDate={currentPlantingDate}
        soilType={soilType}
        totalAreaHa={currentAreaHa || 0.1}
        weather={weather}
      />

      <section className="card advisory-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Crop schedule</p>
            <h2>Fertiliser, protection, and irrigation rhythm</h2>
          </div>
          {selectedCrop ? <span className="badge accent">{selectedCrop.name}</span> : null}
        </div>
        {selectedCrop ? (
          <div className="timeline">
            {selectedCrop.schedule.map((task) => {
              const taskDate = new Date(`${currentPlantingDate}T00:00:00`);
              taskDate.setDate(taskDate.getDate() + task.dayOffset);
              const taskIso = taskDate.toISOString().slice(0, 10);

              return (
                <div className="timeline-item" key={`${selectedCrop.id}-${task.title}`}>
                  <span className="timeline-day">Day {task.dayOffset}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.note}</p>
                    <small>
                      {task.input ? `${task.input}${task.amount ? ` | ${task.amount}` : ''}` : task.stage}
                    </small>
                    <small>Planned for {formatDate(taskIso)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Choose a crop from Setup to generate the water and schedule plan.</p>
        )}
      </section>
    </>
  );
}

export default FarmerWaterDashboard;
