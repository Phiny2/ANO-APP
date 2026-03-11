import type { CropId, CropIssue } from '../data';
import type { FarmerCropPlan, PlantingProgressEntry } from './app-types';
import type { WeatherSummary } from './weather';

type BudgetKind =
  | 'seed'
  | 'planting-material'
  | 'fertiliser'
  | 'herbicide'
  | 'pesticide'
  | 'fungicide';

interface SupplierSource {
  vendor: string;
  label: string;
  url: string;
  checkedOn: string;
}

interface InputConfig {
  id: string;
  cropId: CropId;
  kind: BudgetKind;
  title: string;
  stage: string;
  dayOffset: number;
  productName: string;
  ratePerHa: number;
  quantityUnit: 'kg' | 'l' | 'ha-pack';
  packSize: number;
  packUnit: 'kg' | 'l' | 'ha-pack';
  packPriceUsd: number;
  note: string;
  source: SupplierSource;
  issueIds?: string[];
}

interface IssueProductConfig {
  cropId: CropId;
  issueId: string;
  title: string;
  productName?: string;
  productKind?: BudgetKind;
  productRate?: string;
  packPriceUsd?: number;
  source?: SupplierSource;
  advice: string;
}

export interface BudgetLineItem {
  id: string;
  kind: BudgetKind;
  title: string;
  stage: string;
  plannedDate: string;
  productName: string;
  ratePerHa: number;
  quantityUnit: 'kg' | 'l' | 'ha-pack';
  quantityNeeded: number;
  quantityLabel: string;
  packSize: number;
  packUnit: 'kg' | 'l' | 'ha-pack';
  packLabel: string;
  packsNeeded: number;
  packPriceUsd: number;
  stageCostUsd: number;
  note: string;
  source: SupplierSource;
  weatherDelay: string;
}

export interface BudgetSeedSummary {
  productName: string;
  requiredQuantity: number;
  quantityLabel: string;
  packLabel: string;
  packsNeeded: number;
  packPriceUsd: number;
  estimatedCostUsd: number;
  source: SupplierSource;
  note: string;
}

export interface QuoteOnlyItem {
  title: string;
  productName: string;
  quantityLabel: string;
  note: string;
}

export interface BudgetSummary {
  cropId: CropId;
  totalAreaHa: number;
  knownCostUsd: number;
  stageLines: BudgetLineItem[];
  seedSummary: BudgetSeedSummary | null;
  quoteOnlyItems: QuoteOnlyItem[];
}

export interface PlantingProgressSummary {
  totalAreaHa: number;
  plantedAreaHa: number;
  remainingAreaHa: number;
  completionPercent: number;
  lastEntryDate?: string;
  status: 'not-started' | 'in-progress' | 'completed';
}

export interface DiagnosisProductRecommendation {
  title: string;
  productName?: string;
  productKind?: BudgetKind;
  productRate?: string;
  packPriceUsd?: number;
  source?: SupplierSource;
  advice: string;
}

const checkedOn = '2026-03-10';

const sourceCatalog = {
  maizeSeed: {
    vendor: 'ZBMS',
    label: 'SC 513 10kg seed price',
    url: 'https://www.zbms.co.zw/shop/agriculture/seeds/seedsa07-10kg-sc-513-gls-2/',
    checkedOn,
  },
  wheatSeedNduna: {
    vendor: 'Seed Co Zimbabwe Online Shop',
    label: 'SC Nduna wheat seed',
    url: 'https://www.seedcoonlineshop.com/zw/product/sc-nduna/',
    checkedOn,
  },
  wheatSeedSelect: {
    vendor: 'Seed Co Zimbabwe Online Shop',
    label: 'SC Select wheat seed',
    url: 'https://www.seedcoonlineshop.com/zw/product/sc-select/',
    checkedOn,
  },
  soySeed: {
    vendor: 'Seed Co Zimbabwe Online Shop',
    label: 'SC Safari soyabean seed',
    url: 'https://www.seedcoonlineshop.com/zw/product/sc-safari-indeterminate/',
    checkedOn,
  },
  tobaccoSeedlings: {
    vendor: 'Kutsaga',
    label: 'Tobacco seedlings per hectare',
    url: 'https://kutsaga.co.zw/shop/',
    checkedOn,
  },
  compoundD: {
    vendor: 'ZBMS',
    label: 'ZFC Maize Fert Compound D 50kg',
    url: 'https://www.zbms.co.zw/shop/agriculture/fertilizer/ferta03-50kg-zfc-maize-fert-compound-d-7147/',
    checkedOn,
  },
  ammoniumNitrate: {
    vendor: 'ZBMS',
    label: 'ZFC ammonium nitrate 50kg',
    url: 'https://www.zbms.co.zw/shop/agriculture/fertilizer/ferta17-50kg-zfc-ammonium-nitrate-top-dressing/',
    checkedOn,
  },
  urea: {
    vendor: 'ZBMS',
    label: 'ZFC urea 50kg',
    url: 'https://www.zbms.co.zw/shop/agriculture/fertilizer/urea-zfc-46-n/',
    checkedOn,
  },
  tobaccoPlantingFert: {
    vendor: 'ZBMS',
    label: 'ZFC tobacco planting fertiliser 50kg',
    url: 'https://www.zbms.co.zw/shop/agriculture/fertilizer/ferta26-50kg-zfc-tobacco-plantingfert/',
    checkedOn,
  },
  tobaccoBlend: {
    vendor: 'ZBMS',
    label: 'ZFC tobacco blend 50kg',
    url: 'https://www.zbms.co.zw/shop/agriculture/fertilizer/ferta27-50kg-zfc-tobacco-blend/',
    checkedOn,
  },
  dublon: {
    vendor: 'Tiger Agro Chem',
    label: 'Dublon Super herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/dublon-super-herbicide',
    checkedOn,
  },
  sima: {
    vendor: 'Tiger Agro Chem',
    label: 'Simba herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/simba-herbicide',
    checkedOn,
  },
  treiser: {
    vendor: 'Tiger Agro Chem',
    label: 'Treiser herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/treiser-herbicide',
    checkedOn,
  },
  lastik: {
    vendor: 'Tiger Agro Chem',
    label: 'Lastik Extra herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/lastik-extra-herbicide',
    checkedOn,
  },
  egida: {
    vendor: 'Tiger Agro Chem',
    label: 'Egida herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/egida-herbicide',
    checkedOn,
  },
  demetra: {
    vendor: 'Tiger Agro Chem',
    label: 'Demetra herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/demetra-herbicide',
    checkedOn,
  },
  lazurit: {
    vendor: 'Tiger Agro Chem',
    label: 'Lazurit Ultra herbicide',
    url: 'https://www.tigeragrochem.co.zw/product-page/lazurit-ultra-herbicide',
    checkedOn,
  },
  tanrek: {
    vendor: 'Tiger Agro Chem',
    label: 'Tanrek 500 insecticide',
    url: 'https://www.tigeragrochem.co.zw/product-page/tanrek-500-insecticide',
    checkedOn,
  },
  diperall: {
    vendor: 'Tiger Agro Chem',
    label: 'Diperall insecticide',
    url: 'https://www.tigeragrochem.co.zw/product-page/diperall-acaricide',
    checkedOn,
  },
  rayok: {
    vendor: 'Tiger Agro Chem',
    label: 'Rayok fungicide 250ml',
    url: 'https://www.tigeragrochem.co.zw/product-page/rayok-fungicide',
    checkedOn,
  },
  metaxyl: {
    vendor: 'Tiger Agro Chem',
    label: 'Metaxyl fungicide 1kg',
    url: 'https://www.tigeragrochem.co.zw/product-page/metaxly-fungicide',
    checkedOn,
  },
} as const;

const budgetConfigs: Record<CropId, InputConfig[]> = {
  maize: [
    {
      id: 'maize-seed',
      cropId: 'maize',
      kind: 'seed',
      title: 'Seed requirement',
      stage: 'Planting',
      dayOffset: 0,
      productName: 'SC 513 maize seed',
      ratePerHa: 25,
      quantityUnit: 'kg',
      packSize: 10,
      packUnit: 'kg',
      packPriceUsd: 33,
      note: 'Estimate uses 25 kg of seed per hectare and 10 kg packs as the buying unit.',
      source: sourceCatalog.maizeSeed,
    },
    {
      id: 'maize-basal',
      cropId: 'maize',
      kind: 'fertiliser',
      title: 'Basal fertiliser',
      stage: 'Planting',
      dayOffset: 0,
      productName: 'ZFC Compound D 7:14:7',
      ratePerHa: 300,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 35,
      note: 'Budget uses the middle of the 250-350 kg/ha recommendation.',
      source: sourceCatalog.compoundD,
    },
    {
      id: 'maize-herbicide',
      cropId: 'maize',
      kind: 'herbicide',
      title: 'Early weed control',
      stage: '10 days after emergence',
      dayOffset: 10,
      productName: 'Dublon Super herbicide',
      ratePerHa: 0.4,
      quantityUnit: 'kg',
      packSize: 0.5,
      packUnit: 'kg',
      packPriceUsd: 20,
      note: 'Applied while weeds are still young in maize stands.',
      source: sourceCatalog.dublon,
      issueIds: ['broadleaf-weeds'],
    },
    {
      id: 'maize-topdress',
      cropId: 'maize',
      kind: 'fertiliser',
      title: 'Top dressing',
      stage: '3 to 5 leaf stage',
      dayOffset: 21,
      productName: 'ZFC ammonium nitrate',
      ratePerHa: 200,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 62.7,
      note: 'Application is pushed back if rain is forecast for the next day.',
      source: sourceCatalog.ammoniumNitrate,
      issueIds: ['nitrogen-deficiency'],
    },
    {
      id: 'maize-pest',
      cropId: 'maize',
      kind: 'pesticide',
      title: 'Armyworm protection window',
      stage: 'Early scouting window',
      dayOffset: 18,
      productName: 'Diperall insecticide',
      ratePerHa: 0.2,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 9,
      note: 'Budget line assumes a threshold-triggered spray during the early whorl stage.',
      source: sourceCatalog.diperall,
      issueIds: ['fall-armyworm'],
    },
  ],
  tobacco: [
    {
      id: 'tobacco-seedlings',
      cropId: 'tobacco',
      kind: 'planting-material',
      title: 'Planting material',
      stage: 'Transplanting',
      dayOffset: 0,
      productName: 'Kutsaga tobacco seedlings',
      ratePerHa: 1,
      quantityUnit: 'ha-pack',
      packSize: 1,
      packUnit: 'ha-pack',
      packPriceUsd: 430,
      note: 'Kutsaga lists tobacco seedlings at US$430 per hectare, which works better than bag logic for tobacco.',
      source: sourceCatalog.tobaccoSeedlings,
    },
    {
      id: 'tobacco-basal',
      cropId: 'tobacco',
      kind: 'fertiliser',
      title: 'Starter planting fertiliser',
      stage: 'Transplanting',
      dayOffset: 0,
      productName: 'ZFC tobacco planting fertiliser 5:15:12',
      ratePerHa: 800,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 55,
      note: 'Budget uses the midpoint of the 700-900 kg/ha transplant recommendation.',
      source: sourceCatalog.tobaccoPlantingFert,
    },
    {
      id: 'tobacco-herbicide',
      cropId: 'tobacco',
      kind: 'herbicide',
      title: 'Ridge weed clean-up',
      stage: 'Early establishment',
      dayOffset: 7,
      productName: 'Treiser herbicide',
      ratePerHa: 1,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 7,
      note: 'Treiser is used as the tobacco-safe weed budget line for early ridges.',
      source: sourceCatalog.treiser,
      issueIds: ['nutsedge'],
    },
    {
      id: 'tobacco-topdress',
      cropId: 'tobacco',
      kind: 'fertiliser',
      title: 'Rapid growth feeding',
      stage: '18 days after transplanting',
      dayOffset: 18,
      productName: 'ZFC tobacco blend 6:28:23',
      ratePerHa: 150,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 82.5,
      note: 'This line captures the main follow-up feed during strong vegetative growth.',
      source: sourceCatalog.tobaccoBlend,
    },
    {
      id: 'tobacco-pest',
      cropId: 'tobacco',
      kind: 'pesticide',
      title: 'Aphid and sucking pest control',
      stage: 'Early scouting window',
      dayOffset: 12,
      productName: 'Tanrek 500 insecticide',
      ratePerHa: 0.2,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 12,
      note: 'Rate sits inside the foliar spray range for sucking pests.',
      source: sourceCatalog.tanrek,
      issueIds: ['aphids'],
    },
    {
      id: 'tobacco-fungicide',
      cropId: 'tobacco',
      kind: 'fungicide',
      title: 'Blue mould protection',
      stage: 'Humid disease window',
      dayOffset: 14,
      productName: 'Metaxyl fungicide',
      ratePerHa: 2,
      quantityUnit: 'kg',
      packSize: 1,
      packUnit: 'kg',
      packPriceUsd: 20,
      note: 'Added as a disease-protection line when humid conditions raise blue mould pressure.',
      source: sourceCatalog.metaxyl,
      issueIds: ['blue-mould'],
    },
  ],
  wheat: [
    {
      id: 'wheat-seed',
      cropId: 'wheat',
      kind: 'seed',
      title: 'Seed requirement',
      stage: 'Planting',
      dayOffset: 0,
      productName: 'SC Nduna wheat seed',
      ratePerHa: 125,
      quantityUnit: 'kg',
      packSize: 25,
      packUnit: 'kg',
      packPriceUsd: 43.94,
      note: 'Budget uses a common irrigated wheat rate of 125 kg/ha and 25 kg packs.',
      source: sourceCatalog.wheatSeedNduna,
    },
    {
      id: 'wheat-basal',
      cropId: 'wheat',
      kind: 'fertiliser',
      title: 'Basal placement',
      stage: 'Planting',
      dayOffset: 0,
      productName: 'ZFC Compound D 7:14:7',
      ratePerHa: 350,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 35,
      note: 'Budget uses the middle of the 300-400 kg/ha basal placement range.',
      source: sourceCatalog.compoundD,
    },
    {
      id: 'wheat-herbicide',
      cropId: 'wheat',
      kind: 'herbicide',
      title: 'Grass weed control',
      stage: 'Early tillering',
      dayOffset: 14,
      productName: 'Lastik Extra herbicide',
      ratePerHa: 0.9,
      quantityUnit: 'l',
      packSize: 1,
      packUnit: 'l',
      packPriceUsd: 23,
      note: 'Designed for annual and perennial grass control in wheat and barley.',
      source: sourceCatalog.lastik,
      issueIds: ['wild-oats'],
    },
    {
      id: 'wheat-topdress',
      cropId: 'wheat',
      kind: 'fertiliser',
      title: 'Tillering top dressing',
      stage: 'Tillering',
      dayOffset: 21,
      productName: 'ZFC ammonium nitrate',
      ratePerHa: 150,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 62.7,
      note: 'Budget uses the upper end of split top-dressing in irrigated wheat.',
      source: sourceCatalog.ammoniumNitrate,
      issueIds: ['nitrogen-loss'],
    },
    {
      id: 'wheat-fungicide',
      cropId: 'wheat',
      kind: 'fungicide',
      title: 'Rust spray',
      stage: 'Canopy build',
      dayOffset: 28,
      productName: 'Rayok fungicide',
      ratePerHa: 0.25,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 10,
      note: 'Used as the rust-response cost line when scouting confirms disease pressure.',
      source: sourceCatalog.rayok,
      issueIds: ['rust'],
    },
  ],
  sugarcane: [
    {
      id: 'sugarcane-basal',
      cropId: 'sugarcane',
      kind: 'fertiliser',
      title: 'Starter fertiliser',
      stage: 'Sett placement',
      dayOffset: 0,
      productName: 'ZFC Compound D 7:14:7',
      ratePerHa: 500,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 35,
      note: 'Cane budget uses 500 kg/ha within the 450-600 kg/ha starter range.',
      source: sourceCatalog.compoundD,
    },
    {
      id: 'sugarcane-herbicide',
      cropId: 'sugarcane',
      kind: 'herbicide',
      title: 'Row weed control',
      stage: 'Early tillering',
      dayOffset: 21,
      productName: 'Egida herbicide',
      ratePerHa: 0.25,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 30,
      note: 'Egida is budgeted for broadleaf weed pressure in young cane blocks.',
      source: sourceCatalog.egida,
      issueIds: ['grass-weeds'],
    },
    {
      id: 'sugarcane-topdress',
      cropId: 'sugarcane',
      kind: 'fertiliser',
      title: 'Nitrogen side dressing',
      stage: 'Tillering',
      dayOffset: 45,
      productName: 'ZFC urea 46% N',
      ratePerHa: 200,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 65,
      note: 'Budget uses the midpoint of the 180-250 kg/ha cane nitrogen range.',
      source: sourceCatalog.urea,
    },
    {
      id: 'sugarcane-pest',
      cropId: 'sugarcane',
      kind: 'pesticide',
      title: 'Stalk borer protection',
      stage: 'Early borer window',
      dayOffset: 45,
      productName: 'Diperall insecticide',
      ratePerHa: 0.2,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 9,
      note: 'Budget line allows for a single threshold-triggered stalk borer spray.',
      source: sourceCatalog.diperall,
      issueIds: ['borer'],
    },
  ],
  soyabean: [
    {
      id: 'soy-seed',
      cropId: 'soyabean',
      kind: 'seed',
      title: 'Seed requirement',
      stage: 'Planting',
      dayOffset: 0,
      productName: 'SC Safari soyabean seed',
      ratePerHa: 70,
      quantityUnit: 'kg',
      packSize: 25,
      packUnit: 'kg',
      packPriceUsd: 55,
      note: 'Estimate uses 70 kg/ha and the 25 kg pack size listed by Seed Co.',
      source: sourceCatalog.soySeed,
    },
    {
      id: 'soy-basal',
      cropId: 'soyabean',
      kind: 'fertiliser',
      title: 'Starter phosphorus support',
      stage: 'Planting',
      dayOffset: 0,
      productName: 'ZFC Compound D 7:14:7',
      ratePerHa: 200,
      quantityUnit: 'kg',
      packSize: 50,
      packUnit: 'kg',
      packPriceUsd: 35,
      note: 'A light starter fertiliser line is budgeted alongside inoculation and planting.',
      source: sourceCatalog.compoundD,
    },
    {
      id: 'soy-herbicide',
      cropId: 'soyabean',
      kind: 'herbicide',
      title: 'Early weed clean-up',
      stage: 'Vegetative growth',
      dayOffset: 14,
      productName: 'Lazurit Ultra herbicide',
      ratePerHa: 1,
      quantityUnit: 'l',
      packSize: 1,
      packUnit: 'l',
      packPriceUsd: 26,
      note: 'Used for annual grasses and broadleaf weeds in soyabean blocks.',
      source: sourceCatalog.lazurit,
    },
    {
      id: 'soy-pest',
      cropId: 'soyabean',
      kind: 'pesticide',
      title: 'Pod sucking bug window',
      stage: 'Flowering to pod set',
      dayOffset: 35,
      productName: 'Tanrek 500 insecticide',
      ratePerHa: 0.2,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 12,
      note: 'Budget assumes one threshold-based pod bug spray in flowering.',
      source: sourceCatalog.tanrek,
      issueIds: ['pod-sucking-bugs'],
    },
    {
      id: 'soy-fungicide',
      cropId: 'soyabean',
      kind: 'fungicide',
      title: 'Rust protection',
      stage: 'Canopy disease window',
      dayOffset: 35,
      productName: 'Rayok fungicide',
      ratePerHa: 0.25,
      quantityUnit: 'l',
      packSize: 0.25,
      packUnit: 'l',
      packPriceUsd: 10,
      note: 'Use this as the budgeted rust-response line if scouting confirms lesions.',
      source: sourceCatalog.rayok,
      issueIds: ['soy-rust'],
    },
  ],
};

const issueProducts: IssueProductConfig[] = [
  {
    cropId: 'maize',
    issueId: 'fall-armyworm',
    title: 'Fall armyworm response',
    productName: 'Diperall insecticide',
    productKind: 'pesticide',
    productRate: '0.15 to 0.3 L/ha',
    packPriceUsd: 9,
    source: sourceCatalog.diperall,
    advice: 'Spray directly into the whorl, then re-scout after three to five days before repeating.',
  },
  {
    cropId: 'maize',
    issueId: 'broadleaf-weeds',
    title: 'Maize weed clean-up',
    productName: 'Dublon Super herbicide',
    productKind: 'herbicide',
    productRate: '0.3 to 0.5 kg/ha',
    packPriceUsd: 20,
    source: sourceCatalog.dublon,
    advice: 'Apply while weeds are still small and maize is safely within the label stage.',
  },
  {
    cropId: 'maize',
    issueId: 'nitrogen-deficiency',
    title: 'Nitrogen recovery',
    productName: 'ZFC ammonium nitrate',
    productKind: 'fertiliser',
    productRate: '150 to 200 kg/ha',
    packPriceUsd: 62.7,
    source: sourceCatalog.ammoniumNitrate,
    advice: "Only top dress once soil moisture is adequate and tomorrow's rain is not likely to cause leaching.",
  },
  {
    cropId: 'tobacco',
    issueId: 'aphids',
    title: 'Aphid control',
    productName: 'Tanrek 500 insecticide',
    productKind: 'pesticide',
    productRate: '70 ml to 300 ml/ha',
    packPriceUsd: 12,
    source: sourceCatalog.tanrek,
    advice: 'Target hot spots early and check for virus pressure in adjacent plants.',
  },
  {
    cropId: 'tobacco',
    issueId: 'blue-mould',
    title: 'Blue mould protection',
    productName: 'Metaxyl fungicide',
    productKind: 'fungicide',
    productRate: '2 to 3 kg/ha',
    packPriceUsd: 20,
    source: sourceCatalog.metaxyl,
    advice: 'Combine fungicide use with airflow management and avoid wetting the canopy late in the day.',
  },
  {
    cropId: 'tobacco',
    issueId: 'nutsedge',
    title: 'Tobacco weed clean-up',
    productName: 'Treiser herbicide',
    productKind: 'herbicide',
    productRate: '0.7 to 2 L/ha',
    packPriceUsd: 7,
    source: sourceCatalog.treiser,
    advice: 'Use at the correct tobacco-safe timing before weeds harden off on the ridge.',
  },
  {
    cropId: 'wheat',
    issueId: 'rust',
    title: 'Rust response',
    productName: 'Rayok fungicide',
    productKind: 'fungicide',
    productRate: '200 to 350 ml/ha',
    packPriceUsd: 10,
    source: sourceCatalog.rayok,
    advice: 'Act quickly once pustules are confirmed and keep the irrigation interval even.',
  },
  {
    cropId: 'wheat',
    issueId: 'wild-oats',
    title: 'Grass weed control',
    productName: 'Lastik Extra herbicide',
    productKind: 'herbicide',
    productRate: '0.8 to 1 L/ha',
    packPriceUsd: 23,
    source: sourceCatalog.lastik,
    advice: 'Spray when the target grasses are still in the recommended leaf stage.',
  },
  {
    cropId: 'wheat',
    issueId: 'nitrogen-loss',
    title: 'Nitrogen top-up',
    productName: 'ZFC ammonium nitrate',
    productKind: 'fertiliser',
    productRate: '100 to 150 kg/ha',
    packPriceUsd: 62.7,
    source: sourceCatalog.ammoniumNitrate,
    advice: 'Split the next dress if irrigation or rainfall could wash nitrogen out of the root zone.',
  },
  {
    cropId: 'sugarcane',
    issueId: 'borer',
    title: 'Stalk borer control',
    productName: 'Diperall insecticide',
    productKind: 'pesticide',
    productRate: '0.15 to 0.3 L/ha',
    packPriceUsd: 9,
    source: sourceCatalog.diperall,
    advice: 'Treat the affected block early and destroy badly damaged stools to keep pressure low.',
  },
  {
    cropId: 'sugarcane',
    issueId: 'smut',
    title: 'Sugarcane smut management',
    advice: 'Rogue infected stools, destroy infected material, and replant future fields with clean seed cane.',
  },
  {
    cropId: 'sugarcane',
    issueId: 'grass-weeds',
    title: 'Young cane weed clean-up',
    productName: 'Egida herbicide',
    productKind: 'herbicide',
    productRate: '200 to 330 ml/ha',
    packPriceUsd: 30,
    source: sourceCatalog.egida,
    advice: 'Use early while grasses and broadleaf weeds are still small and cane rows remain open.',
  },
  {
    cropId: 'soyabean',
    issueId: 'soy-rust',
    title: 'Soy rust response',
    productName: 'Rayok fungicide',
    productKind: 'fungicide',
    productRate: '200 to 350 ml/ha',
    packPriceUsd: 10,
    source: sourceCatalog.rayok,
    advice: 'Scout lower leaves first and spray before the lesions move up the canopy.',
  },
  {
    cropId: 'soyabean',
    issueId: 'pod-sucking-bugs',
    title: 'Pod bug response',
    productName: 'Tanrek 500 insecticide',
    productKind: 'pesticide',
    productRate: '70 ml to 300 ml/ha',
    packPriceUsd: 12,
    source: sourceCatalog.tanrek,
    advice: 'Spray at threshold and clear nearby weed hosts to reduce re-infestation.',
  },
];

function addDays(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatUnitLabel(value: number, unit: InputConfig['quantityUnit']) {
  const normalizedUnit = unit === 'ha-pack' ? 'ha packs' : unit;
  return `${formatNumber(value)} ${normalizedUnit}`;
}

function formatPackLabel(packSize: number, packUnit: InputConfig['packUnit']) {
  if (packUnit === 'ha-pack') {
    return `${formatNumber(packSize)} ha pack`;
  }

  return `${formatNumber(packSize)} ${packUnit}`;
}

function shouldDelayFertiliser(plannedDate: string, weather: WeatherSummary | null) {
  if (!weather) {
    return '';
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const rainLikely = weather.tomorrowRainChance >= 55 || weather.tomorrowRainMm >= 5;

  if (plannedDate === tomorrowIso && rainLikely) {
    return 'Rain is likely tomorrow, so delay this fertiliser application until the field dries enough to prevent losses.';
  }

  return '';
}

export function formatUsd(value: number | null) {
  if (value === null) {
    return 'Quote required';
  }

  return `US$${value.toFixed(2)}`;
}

export function buildBudgetSummary(
  cropId: CropId,
  totalAreaHa: number,
  plantingDate: string,
  weather: WeatherSummary | null,
): BudgetSummary {
  const safeArea = Math.max(totalAreaHa, 0);
  const configs = budgetConfigs[cropId] ?? [];
  const stageLines = configs.map<BudgetLineItem>((config) => {
    const quantityNeeded = safeArea * config.ratePerHa;
    const packsNeeded = Math.ceil(quantityNeeded / config.packSize);
    const plannedDate = addDays(plantingDate, config.dayOffset);

    return {
      id: config.id,
      kind: config.kind,
      title: config.title,
      stage: config.stage,
      plannedDate,
      productName: config.productName,
      ratePerHa: config.ratePerHa,
      quantityUnit: config.quantityUnit,
      quantityNeeded,
      quantityLabel: formatUnitLabel(quantityNeeded, config.quantityUnit),
      packSize: config.packSize,
      packUnit: config.packUnit,
      packLabel: formatPackLabel(config.packSize, config.packUnit),
      packsNeeded,
      packPriceUsd: config.packPriceUsd,
      stageCostUsd: packsNeeded * config.packPriceUsd,
      note: config.note,
      source: config.source,
      weatherDelay:
        config.kind === 'fertiliser' ? shouldDelayFertiliser(plannedDate, weather) : '',
    };
  });

  const seedLine =
    stageLines.find((item) => item.kind === 'seed' || item.kind === 'planting-material') ?? null;
  const quoteOnlyItems: QuoteOnlyItem[] =
    cropId === 'sugarcane'
      ? [
          {
            title: 'Seed cane estimate',
            productName: 'Clean seed cane / setts',
            quantityLabel: `${formatNumber(safeArea * 8)} tonnes`,
            note: 'No public Zimbabwe online sett price was found, so the app leaves planting material as a contract quote item.',
          },
        ]
      : [];

  return {
    cropId,
    totalAreaHa: safeArea,
    knownCostUsd: stageLines.reduce((total, item) => total + item.stageCostUsd, 0),
    stageLines,
    seedSummary: seedLine
      ? {
          productName: seedLine.productName,
          requiredQuantity: seedLine.quantityNeeded,
          quantityLabel: seedLine.quantityLabel,
          packLabel: seedLine.packLabel,
          packsNeeded: seedLine.packsNeeded,
          packPriceUsd: seedLine.packPriceUsd,
          estimatedCostUsd: seedLine.stageCostUsd,
          source: seedLine.source,
          note: seedLine.note,
        }
      : null,
    quoteOnlyItems,
  };
}

export function buildPlantingProgressSummary(
  plan: FarmerCropPlan | null,
  plantingEntries: PlantingProgressEntry[],
): PlantingProgressSummary {
  const totalAreaHa = plan?.totalAreaHa ?? 0;
  const plantedAreaHa = plantingEntries.reduce((total, entry) => total + entry.areaHa, 0);
  const remainingAreaHa = Math.max(totalAreaHa - plantedAreaHa, 0);
  const completionPercent = totalAreaHa > 0 ? Math.min((plantedAreaHa / totalAreaHa) * 100, 100) : 0;
  const lastEntryDate = plantingEntries
    .slice()
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))[0]?.entryDate;

  return {
    totalAreaHa,
    plantedAreaHa,
    remainingAreaHa,
    completionPercent,
    lastEntryDate,
    status:
      plantedAreaHa <= 0
        ? 'not-started'
        : remainingAreaHa <= 0
          ? 'completed'
          : 'in-progress',
  };
}

export function getIssueRecommendation(cropId: CropId, issue: CropIssue): DiagnosisProductRecommendation {
  return (
    issueProducts.find((item) => item.cropId === cropId && item.issueId === issue.id) ?? {
      title: issue.title,
      advice: issue.recommendation,
    }
  );
}
