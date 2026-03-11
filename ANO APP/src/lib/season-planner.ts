import { crops, regions, type Country, type CropId } from '../data';
import { buildBudgetSummary } from './economics';
import { buildProfitabilitySummary } from './enterprise';
import type { WeatherSummary } from './weather';

export interface SeasonRecommendation {
  cropId: CropId;
  cropName: string;
  seasonLabel: string;
  suggestedPlantingDate: string;
  estimatedInputCostPerHaUsd: number;
  estimatedTotalCostPerHaUsd: number;
  estimatedTotalCostUsd: number;
  expectedMarginPerHaUsd: number | null;
  expectedYieldPerHa: number;
  yieldUnit: string;
  varieties: string[];
  reason: string;
  caution?: string;
  score: number;
}

function nextWindowDate(cropId: CropId, currentDate: Date) {
  const year = currentDate.getUTCFullYear();
  const windows: Record<CropId, { month: number; day: number; label: (yearValue: number) => string }> = {
    maize: {
      month: 11,
      day: 15,
      label: (yearValue) => `Summer ${yearValue}/${String((yearValue + 1) % 100).padStart(2, '0')}`,
    },
    tobacco: {
      month: 9,
      day: 20,
      label: (yearValue) => `Tobacco ${yearValue}/${String((yearValue + 1) % 100).padStart(2, '0')}`,
    },
    wheat: {
      month: 5,
      day: 20,
      label: (yearValue) => `Winter ${yearValue}`,
    },
    sugarcane: {
      month: 9,
      day: 1,
      label: (yearValue) => `Cane cycle ${yearValue}/${String((yearValue + 1) % 100).padStart(2, '0')}`,
    },
    soyabean: {
      month: 11,
      day: 10,
      label: (yearValue) => `Summer ${yearValue}/${String((yearValue + 1) % 100).padStart(2, '0')}`,
    },
  };

  const config = windows[cropId];
  const candidate = new Date(Date.UTC(year, config.month - 1, config.day));
  const targetYear = candidate <= currentDate ? year + 1 : year;
  const suggestedPlantingDate = new Date(Date.UTC(targetYear, config.month - 1, config.day))
    .toISOString()
    .slice(0, 10);

  return {
    seasonLabel: config.label(targetYear),
    suggestedPlantingDate,
  };
}

function scoreRotation(currentCropId: CropId | null, nextCropId: CropId, regionId: string) {
  let score = 0;
  let reason = 'Strong fit for the next production window.';

  if (!currentCropId || currentCropId !== nextCropId) {
    score += 80;
  } else {
    score -= 110;
    reason = 'Same-crop follow-on season is possible, but rotation value is lower.';
  }

  if (currentCropId === 'maize' && nextCropId === 'soyabean') {
    score += 180;
    reason = 'Soyabean can reset rotation pressure and supports the following grain crop.';
  }

  if (currentCropId === 'soyabean' && nextCropId === 'maize') {
    score += 150;
    reason = 'Maize after soyabean often benefits from cleaner rotation and stronger soil nitrogen carryover.';
  }

  if (currentCropId === 'tobacco' && nextCropId === 'wheat') {
    score += 140;
    reason = 'Wheat is a strong next irrigated window after tobacco where water and land preparation are ready.';
  }

  if ((regionId === 'masvingo-lowveld' || regionId === 'eswatini-lowveld') && nextCropId === 'sugarcane') {
    score += 140;
    reason = 'Lowveld conditions keep sugarcane highly competitive in the next crop cycle.';
  }

  if ((regionId === 'mat-north' || regionId === 'mat-south') && nextCropId === 'maize') {
    score -= 70;
  }

  return { score, reason };
}

function getVarieties(country: Country, regionId: string, cropId: CropId) {
  return (
    crops.find((crop) => crop.id === cropId)?.varieties.filter((variety) => {
      const matchesCountry = !variety.countries || variety.countries.includes(country);
      const matchesRegion = !variety.regionIds || variety.regionIds.includes(regionId);
      return matchesCountry && matchesRegion;
    }) ?? []
  );
}

export function buildSeasonOutlook(input: {
  country: Country;
  regionId: string;
  currentCropId: CropId | null;
  targetAreaHa: number;
  weather: WeatherSummary | null;
  currentDate?: Date;
}) {
  const region = regions.find((entry) => entry.id === input.regionId);
  if (!region) {
    return [];
  }

  const currentDate = input.currentDate ?? new Date();

  return region.crops
    .map<SeasonRecommendation>((cropId) => {
      const crop = crops.find((entry) => entry.id === cropId)!;
      const window = nextWindowDate(cropId, currentDate);
      const perHaBudget = buildBudgetSummary(cropId, 1, window.suggestedPlantingDate, input.weather);
      const totalBudget = buildBudgetSummary(cropId, input.targetAreaHa, window.suggestedPlantingDate, input.weather);
      const profitability = buildProfitabilitySummary({
        cropId,
        regionId: input.regionId,
        totalAreaHa: 1,
        knownInputCostUsd: perHaBudget.knownCostUsd,
        boardStatus: 'verified',
      });
      const targetScenario = profitability.scenarios.find((scenario) => scenario.label === 'Target') ?? profitability.scenarios[0];
      const rotation = scoreRotation(input.currentCropId, cropId, input.regionId);
      const varieties = getVarieties(input.country, input.regionId, cropId).map((entry) => entry.name);
      const marginPerHa = targetScenario.netMarginUsd;
      const baseScore =
        (marginPerHa ?? 280) +
        rotation.score +
        (profitability.market.priceUsd === null ? -30 : 0) +
        (cropId === 'soyabean' ? 20 : 0);

      return {
        cropId,
        cropName: crop.name,
        seasonLabel: window.seasonLabel,
        suggestedPlantingDate: window.suggestedPlantingDate,
        estimatedInputCostPerHaUsd: Number(perHaBudget.knownCostUsd.toFixed(2)),
        estimatedTotalCostPerHaUsd: Number(profitability.totalCostUsd.toFixed(2)),
        estimatedTotalCostUsd: Number((profitability.totalCostUsd * Math.max(input.targetAreaHa, 0)).toFixed(2)),
        expectedMarginPerHaUsd: marginPerHa === null ? null : Number(marginPerHa.toFixed(2)),
        expectedYieldPerHa: targetScenario.yieldPerHa,
        yieldUnit: targetScenario.unit,
        varieties,
        reason: rotation.reason,
        caution:
          profitability.market.priceUsd === null
            ? 'Buyer contract pricing should be confirmed before relying on the margin forecast.'
            : undefined,
        score: Number(baseScore.toFixed(2)),
      };
    })
    .sort((left, right) => right.score - left.score || left.cropName.localeCompare(right.cropName));
}
