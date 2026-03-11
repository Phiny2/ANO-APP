import type { CropGuide } from '../data';

export interface WeatherSummary {
  source: 'live' | 'fallback';
  todayDate: string;
  tomorrowDate: string;
  todayMaxTemp: number;
  todayRainChance: number;
  todayRainMm: number;
  tomorrowRainChance: number;
  tomorrowRainMm: number;
  forecastDays: Array<{
    date: string;
    maxTemp: number;
    rainChance: number;
    rainMm: number;
  }>;
}

const WEATHER_TIMEZONE = 'Africa/Harare';

function addDays(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

export function getLocalIsoDate() {
  const current = new Date();
  const timezoneOffsetMs = current.getTimezoneOffset() * 60 * 1000;
  return new Date(current.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
}

function daysBetween(fromDate: string, toDate: string) {
  const current = new Date(`${fromDate}T00:00:00`);
  const target = new Date(`${toDate}T00:00:00`);
  const diff = target.getTime() - current.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function buildWeatherFallback(regionId: string, lat: number, lon: number): WeatherSummary {
  const dryRegion = regionId.includes('mat') || regionId.includes('lowveld') || lat < -20 || lon < 30;
  const todayIso = getLocalIsoDate();
  const forecastDays = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(todayIso, index);
    const wetPulse = index % 5 === 2;
    const rainChance = dryRegion
      ? wetPulse
        ? 46
        : 18 + (index % 3) * 6
      : wetPulse
        ? 68
        : 34 + (index % 4) * 8;
    const rainMm = dryRegion
      ? wetPulse
        ? 3.2
        : Number((0.2 + (index % 2) * 0.3).toFixed(1))
      : wetPulse
        ? 6.4
        : Number((1.1 + (index % 3) * 0.8).toFixed(1));
    const maxTemp = dryRegion ? 30 + (index % 3) : 26 + (index % 4);

    return {
      date,
      maxTemp,
      rainChance,
      rainMm,
    };
  });

  return {
    source: 'fallback',
    todayDate: todayIso,
    tomorrowDate: addDays(todayIso, 1),
    todayMaxTemp: forecastDays[0].maxTemp,
    todayRainChance: forecastDays[0].rainChance,
    todayRainMm: forecastDays[0].rainMm,
    tomorrowRainChance: forecastDays[1].rainChance,
    tomorrowRainMm: forecastDays[1].rainMm,
    forecastDays,
  };
}

export async function fetchWeather(regionId: string, lat: number, lon: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max,precipitation_probability_max,precipitation_sum',
    forecast_days: '14',
    timezone: WEATHER_TIMEZONE,
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Weather request failed');
  }

  const data = (await response.json()) as {
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      precipitation_probability_max: number[];
      precipitation_sum: number[];
    };
  };

  if (
    !data.daily ||
    data.daily.time.length < 2 ||
    data.daily.temperature_2m_max.length < 2 ||
    data.daily.precipitation_probability_max.length < 2 ||
    data.daily.precipitation_sum.length < 2
  ) {
    throw new Error('Incomplete weather payload');
  }

  const forecastDays = data.daily.time.map((date, index) => ({
    date,
    maxTemp: Math.round(data.daily!.temperature_2m_max[index]),
    rainChance: Math.round(data.daily!.precipitation_probability_max[index]),
    rainMm: Number(data.daily!.precipitation_sum[index].toFixed(1)),
  }));

  return {
    source: 'live' as const,
    todayDate: data.daily.time[0],
    tomorrowDate: data.daily.time[1],
    todayMaxTemp: Math.round(data.daily.temperature_2m_max[0]),
    todayRainChance: Math.round(data.daily.precipitation_probability_max[0]),
    todayRainMm: Number(data.daily.precipitation_sum[0].toFixed(1)),
    tomorrowRainChance: Math.round(data.daily.precipitation_probability_max[1]),
    tomorrowRainMm: Number(data.daily.precipitation_sum[1].toFixed(1)),
    forecastDays,
  };
}

export function getWeatherAdvice(weather: WeatherSummary | null, crop: CropGuide | null) {
  if (!weather || !crop) {
    return "Select a crop to see whether tomorrow's weather changes your field plan.";
  }

  if (weather.tomorrowRainChance >= 60 || weather.tomorrowRainMm >= 5) {
    return `Rain is likely tomorrow, so delay major ${crop.id === 'sugarcane' ? 'side-dressing' : 'fertiliser'} work and review the field after the rain event.`;
  }

  if (weather.tomorrowRainChance <= 25 && weather.tomorrowRainMm < 1) {
    return 'Tomorrow looks mostly dry, so fertiliser placement and irrigation can go ahead if the field is otherwise ready.';
  }

  return 'Forecast is mixed for tomorrow. Split applications and avoid broadcasting on fields that pond easily.';
}

export function summarizeAlerts(
  crop: CropGuide | null,
  plantingDate: string,
  weather: WeatherSummary | null,
) {
  if (!crop) {
    return [];
  }

  const todayIso = getLocalIsoDate();
  return crop.schedule
    .map((task) => {
      const dueDate = addDays(plantingDate, task.dayOffset);
      const offset = daysBetween(todayIso, dueDate);
      return {
        ...task,
        dueDate,
        offset,
      };
    })
    .filter((task) => task.offset >= -3 && task.offset <= 7)
    .map((task) => {
      if (
        task.kind === 'fertiliser' &&
        weather &&
        (weather.tomorrowRainChance >= 60 || weather.tomorrowRainMm >= 5)
      ) {
        return `${task.title} is due around ${formatDate(task.dueDate)}. Delay it if the rain signal holds into tomorrow.`;
      }

      if (task.offset <= 0) {
        return `${task.title} should be checked now. Window opened on ${formatDate(task.dueDate)}.`;
      }

      return `${task.title} is coming up on ${formatDate(task.dueDate)}.`;
    });
}
