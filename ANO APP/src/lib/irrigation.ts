import type { CropGuide } from '../data';
import type { IrrigationMethod, SoilType } from './app-types';
import type { WeatherSummary } from './weather';

export interface IrrigationSession {
  date: string;
  action: 'irrigate' | 'delay' | 'watch';
  waterMm: number;
  durationHours: number;
  note: string;
}

export interface IrrigationPlan {
  cadenceDays: number;
  stageLabel: string;
  summary: string;
  nextAction: string;
  sessions: IrrigationSession[];
}

const cropCadenceDays: Record<CropGuide['id'], number> = {
  maize: 6,
  tobacco: 4,
  wheat: 7,
  sugarcane: 6,
  soyabean: 6,
};

const methodHoursPerHa: Record<Exclude<IrrigationMethod, 'rainfed'>, number> = {
  drip: 0.8,
  sprinkler: 1.2,
  pivot: 0.9,
  furrow: 1.5,
};

function getStageLabel(daysSincePlanting: number, cropId: CropGuide['id']) {
  if (daysSincePlanting <= 14) {
    return 'Establishment';
  }

  if (cropId === 'sugarcane') {
    if (daysSincePlanting <= 60) {
      return 'Tillering';
    }
    return 'Grand growth';
  }

  if (daysSincePlanting <= 45) {
    return 'Vegetative growth';
  }

  if (daysSincePlanting <= 80) {
    return 'Flowering to grain or leaf fill';
  }

  return 'Maturity window';
}

function daysSince(dateString: string) {
  const now = new Date();
  const target = new Date(`${dateString}T00:00:00`);
  return Math.max(Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

function getCadenceDays(cropId: CropGuide['id'], soilType: SoilType, daysSincePlanting: number) {
  let cadence = cropCadenceDays[cropId];

  if (soilType === 'sandy') {
    cadence -= 1;
  }

  if (soilType === 'clay') {
    cadence += 1;
  }

  if (daysSincePlanting > 20 && daysSincePlanting <= 75) {
    cadence -= 1;
  }

  return Math.max(cadence, 3);
}

function getWaterTargetMm(cropId: CropGuide['id'], soilType: SoilType, daysSincePlanting: number) {
  let base = cropId === 'tobacco' ? 18 : cropId === 'sugarcane' ? 30 : cropId === 'wheat' ? 24 : 22;

  if (soilType === 'sandy') {
    base -= 2;
  }

  if (soilType === 'clay') {
    base += 3;
  }

  if (daysSincePlanting > 20 && daysSincePlanting <= 75) {
    base += 3;
  }

  return Math.max(base, 14);
}

export function formatDurationHours(value: number) {
  return `${value.toFixed(1)} hr`;
}

export function buildIrrigationPlan(input: {
  crop: CropGuide | null;
  weather: WeatherSummary | null;
  plantingDate: string;
  totalAreaHa: number;
  soilType: SoilType;
  irrigationMethod: IrrigationMethod;
}): IrrigationPlan | null {
  if (!input.crop || !input.weather) {
    return null;
  }

  const plantedDays = daysSince(input.plantingDate);
  const cadenceDays = getCadenceDays(input.crop.id, input.soilType, plantedDays);
  const waterMm = getWaterTargetMm(input.crop.id, input.soilType, plantedDays);
  const stageLabel = getStageLabel(plantedDays, input.crop.id);

  if (input.irrigationMethod === 'rainfed') {
    const dryRisk = input.weather.forecastDays
      .slice(0, 7)
      .filter((day) => day.rainMm < 2 && day.rainChance < 45).length;

    return {
      cadenceDays,
      stageLabel,
      summary: 'This farm is marked as rainfed, so the app will monitor moisture stress and rainfall gaps instead of scheduling pump sessions.',
      nextAction:
        dryRisk >= 4
          ? 'The next 7 days look dry. Prepare contingency watering or moisture conservation if equipment is available.'
          : 'Rainfall outlook is still carrying enough moisture support for a rainfed plan.',
      sessions: input.weather.forecastDays.slice(0, 7).map((day) => ({
        date: day.date,
        action: day.rainMm >= 4 || day.rainChance >= 60 ? 'watch' : 'delay',
        waterMm: 0,
        durationHours: 0,
        note:
          day.rainMm >= 4 || day.rainChance >= 60
            ? 'Rain may cover part of the moisture need.'
            : 'Monitor stress because this is a dry day for a rainfed field.',
      })),
    };
  }

  const sessions: IrrigationSession[] = [];
  let dryRun = 0;

  for (const day of input.weather.forecastDays.slice(0, 14)) {
    const heavyRain = day.rainMm >= 5 || day.rainChance >= 65;
    const usefulRain = day.rainMm >= 2 || day.rainChance >= 45;

    if (heavyRain) {
      dryRun = 0;
      sessions.push({
        date: day.date,
        action: 'delay',
        waterMm: 0,
        durationHours: 0,
        note: 'Forecast rain is strong enough to delay irrigation and reassess the field after the event.',
      });
      continue;
    }

    dryRun += usefulRain ? 0.5 : 1;

    if (dryRun >= cadenceDays) {
      const durationHours = Number(
        (
          Math.max(input.totalAreaHa, 0.1) *
          methodHoursPerHa[input.irrigationMethod] *
          (waterMm / 20)
        ).toFixed(1),
      );

      sessions.push({
        date: day.date,
        action: 'irrigate',
        waterMm,
        durationHours,
        note: usefulRain
          ? 'Light rain may help, but a follow-up irrigation block is still recommended for this crop stage.'
          : 'Dry spell is reaching the crop threshold, so schedule irrigation on this day.',
      });
      dryRun = 0;
      continue;
    }

    if (sessions.length < 4) {
      sessions.push({
        date: day.date,
        action: 'watch',
        waterMm: 0,
        durationHours: 0,
        note: usefulRain
          ? 'Light rainfall may top up moisture, so keep watching the field before irrigating.'
          : 'No irrigation yet, but moisture should still be watched closely.',
      });
    }
  }

  const irrigationSessions = sessions.filter((session) => session.action === 'irrigate');
  const nextIrrigation = irrigationSessions[0];

  return {
    cadenceDays,
    stageLabel,
    summary: `Using ${input.irrigationMethod} irrigation on ${input.soilType} soil, the app recommends roughly every ${cadenceDays} days during ${stageLabel.toLowerCase()} unless rainfall resets soil moisture.`,
    nextAction: nextIrrigation
      ? `Next irrigation is suggested around ${nextIrrigation.date} for about ${formatDurationHours(nextIrrigation.durationHours)} across ${Math.max(input.totalAreaHa, 0.1).toFixed(1)} ha.`
      : 'No forced irrigation day stands out yet in the next two weeks, but keep monitoring weather and field moisture.',
    sessions: sessions.slice(0, 8),
  };
}
