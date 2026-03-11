import { boards, crops, regions, type BoardId, type CropId, type CropIssue } from '../data';
import type { BoardStatus } from './app-types';
import type { CropDiagnosisResult } from './diagnosis';

export interface EnterpriseSource {
  label: string;
  vendor: string;
  url: string;
  checkedOn: string;
}

type MarketUnit = 'mt' | 'kg' | 'tonnes cane';
type SupportKind = 'agronomy' | 'board' | 'finance' | 'insurance' | 'payments' | 'mechanisation' | 'market';

interface MarketReference {
  cropId: CropId;
  buyerName: string;
  priceUsd: number | null;
  unit: MarketUnit;
  channel: 'board' | 'auction' | 'contract';
  note: string;
  paymentNote: string;
  source: EnterpriseSource;
  secondaryPriceUsd?: number;
  secondaryLabel?: string;
}

interface YieldProfile {
  unit: MarketUnit;
  conservative: number;
  target: number;
  stretch: number;
}

interface OperatingCostProfile {
  laborPerHa: number;
  irrigationPerHa: number;
  logisticsPerHa: number;
  compliancePerHa: number;
  extraPerHa: number;
  note: string;
}

export interface ProfitScenario {
  label: 'Conservative' | 'Target' | 'Stretch';
  yieldPerHa: number;
  totalOutput: number;
  unit: MarketUnit;
  grossRevenueUsd: number | null;
  totalCostUsd: number;
  netMarginUsd: number | null;
}

export interface ProfitabilitySummary {
  market: MarketReference;
  operatingCostUsd: number;
  totalCostUsd: number;
  breakEvenYieldPerHa: number | null;
  scenarios: ProfitScenario[];
  guidance: string;
  assumptionNote: string;
}

export interface BoardWorkflowStep {
  title: string;
  status: 'ready' | 'action' | 'watch';
  detail: string;
  ctaLabel?: string;
  url?: string;
}

export interface SupportLink {
  kind: SupportKind;
  name: string;
  detail: string;
  contact?: string;
  url?: string;
}

export interface EscalationGuide {
  priority: 'routine' | 'urgent';
  title: string;
  nextAction: string;
  message: string;
  channels: SupportLink[];
}

const checkedOn = '2026-03-10';

const sourceCatalog = {
  gmbPricing: {
    vendor: 'GMB',
    label: 'Producer prices',
    url: 'https://gmbdura.co.zw/pricing/',
    checkedOn,
  },
  gmbDepots: {
    vendor: 'GMB',
    label: 'Depot network',
    url: 'https://gmbdura.co.zw/our-depots/',
    checkedOn,
  },
  agroDura: {
    vendor: 'AgroDura',
    label: 'GMB depot shops',
    url: 'https://gmbdura.co.zw/wp-content/uploads/2025/11/AgroDura.pdf',
    checkedOn,
  },
  timbHome: {
    vendor: 'TIMB',
    label: 'Season opening price snapshot',
    url: 'https://www.timb.co.zw/',
    checkedOn,
  },
  timbContacts: {
    vendor: 'TIMB',
    label: 'Branch contacts',
    url: 'https://www.timb.co.zw/contact.html',
    checkedOn,
  },
  timbMatrix: {
    vendor: 'TIMB',
    label: 'Daily tobacco price matrix',
    url: 'https://www.timb.co.zw/grading-oci/matrix.html',
    checkedOn,
  },
  ministry: {
    vendor: 'Ministry of Agriculture',
    label: 'Extension and online services',
    url: 'https://www.agric.gov.zw/',
    checkedOn,
  },
  ministryContacts: {
    vendor: 'Ministry of Agriculture',
    label: 'Contacts',
    url: 'https://www.agric.gov.zw/wordpress/?page_id=1228',
    checkedOn,
  },
  cbzInsurance: {
    vendor: 'CBZ',
    label: 'Agro Insurance',
    url: 'https://www.cbz.co.zw/insurance/agro-insurance/',
    checkedOn,
  },
  afcLoan: {
    vendor: 'AFC',
    label: 'Loan application',
    url: 'https://www.afcholdings.co.zw/loan-application-form/',
    checkedOn,
  },
  afcLandBank: {
    vendor: 'AFC',
    label: 'Land and Development Bank',
    url: 'https://www.afcholdings.co.zw/land-development-bank/',
    checkedOn,
  },
  ecocashMerchant: {
    vendor: 'EcoCash',
    label: 'Merchant payments',
    url: 'https://ecocash.co.zw/pay-merchant/',
    checkedOn,
  },
} as const;

const marketReferences: Record<CropId, MarketReference> = {
  maize: {
    cropId: 'maize',
    buyerName: 'GMB producer price',
    priceUsd: 380,
    unit: 'mt',
    channel: 'board',
    note: 'Official board planning price for maize deliveries.',
    paymentNote: 'Use this as the board benchmark while comparing private buyer offers.',
    source: sourceCatalog.gmbPricing,
  },
  wheat: {
    cropId: 'wheat',
    buyerName: 'GMB wheat utility and standard',
    priceUsd: 451.35,
    secondaryPriceUsd: 461.35,
    secondaryLabel: 'Premium wheat',
    unit: 'mt',
    channel: 'board',
    note: 'Premium grading pays more, so protein and grading discipline matter.',
    paymentNote: 'Check grade before planning revenue because premium and standard wheat pay differently.',
    source: sourceCatalog.gmbPricing,
  },
  soyabean: {
    cropId: 'soyabean',
    buyerName: 'GMB soyabean producer price',
    priceUsd: 580,
    unit: 'mt',
    channel: 'board',
    note: 'Board price gives a useful floor for soy planning and hold-vs-sell decisions.',
    paymentNote: 'Use this board price as the benchmark when crushers or private buyers approach.',
    source: sourceCatalog.gmbPricing,
  },
  tobacco: {
    cropId: 'tobacco',
    buyerName: 'TIMB season-opening average',
    priceUsd: 2.85,
    unit: 'kg',
    channel: 'auction',
    note: 'This is an early-season average from the 2026 TIMB market opening, not a guaranteed final seasonal average.',
    paymentNote: 'Daily floor averages can move quickly, so watch the TIMB matrix as selling progresses.',
    source: sourceCatalog.timbHome,
  },
  sugarcane: {
    cropId: 'sugarcane',
    buyerName: 'Contract cane value',
    priceUsd: null,
    unit: 'tonnes cane',
    channel: 'contract',
    note: 'Cane revenue is usually contract-based, so the farmer should confirm value with the mill or buyer before relying on margin numbers.',
    paymentNote: 'Treat sugarcane as a contract crop and request a current cane statement before budgeting sales.',
    source: sourceCatalog.ministry,
  },
};

const yieldProfiles: Record<CropId, YieldProfile> = {
  maize: { unit: 'mt', conservative: 4.2, target: 6.5, stretch: 8.5 },
  wheat: { unit: 'mt', conservative: 4.5, target: 6.2, stretch: 7.5 },
  soyabean: { unit: 'mt', conservative: 1.8, target: 2.6, stretch: 3.2 },
  tobacco: { unit: 'kg', conservative: 1800, target: 2300, stretch: 2800 },
  sugarcane: { unit: 'tonnes cane', conservative: 85, target: 105, stretch: 125 },
};

const operatingCosts: Record<CropId, OperatingCostProfile> = {
  maize: {
    laborPerHa: 180,
    irrigationPerHa: 120,
    logisticsPerHa: 70,
    compliancePerHa: 25,
    extraPerHa: 0,
    note: 'Operating estimate includes labour, irrigation energy, local transport, and basic compliance or scouting costs.',
  },
  wheat: {
    laborPerHa: 220,
    irrigationPerHa: 180,
    logisticsPerHa: 80,
    compliancePerHa: 25,
    extraPerHa: 0,
    note: 'Winter wheat assumes stronger irrigation and handling costs than summer grain.',
  },
  soyabean: {
    laborPerHa: 150,
    irrigationPerHa: 90,
    logisticsPerHa: 70,
    compliancePerHa: 20,
    extraPerHa: 0,
    note: 'Soy operating estimate is lighter than maize because field traffic and nutrition stages are usually simpler.',
  },
  tobacco: {
    laborPerHa: 850,
    irrigationPerHa: 220,
    logisticsPerHa: 150,
    compliancePerHa: 110,
    extraPerHa: 460,
    note: 'Tobacco adds curing, grading, and compliance overhead on top of normal field labour.',
  },
  sugarcane: {
    laborPerHa: 240,
    irrigationPerHa: 320,
    logisticsPerHa: 110,
    compliancePerHa: 35,
    extraPerHa: 0,
    note: 'Sugarcane operating estimate reflects heavier irrigation load and crop transport needs.',
  },
};

const timbBranchesByRegion: Record<string, string> = {
  'mash-west': 'Karoi TIMB branch',
  'mash-central': 'Bindura TIMB branch',
  'mash-east': 'Marondera TIMB branch',
  manicaland: 'Mutare TIMB branch',
};

function regionalYieldModifier(cropId: CropId, regionId: string) {
  if (cropId === 'sugarcane') {
    return regionId === 'eswatini-lowveld' || regionId === 'masvingo-lowveld' ? 1.06 : 0.96;
  }

  if (regionId === 'mat-north' || regionId === 'mat-south') {
    return cropId === 'maize' || cropId === 'soyabean' ? 0.82 : 0.9;
  }

  if (regionId === 'eswatini-lowveld') {
    return cropId === 'maize' ? 0.88 : 0.94;
  }

  if (regionId === 'masvingo-lowveld') {
    return cropId === 'wheat' ? 0.95 : 0.9;
  }

  if (regionId === 'manicaland') {
    return cropId === 'tobacco' ? 1.03 : 1;
  }

  return 1;
}

function scenarioLabel(scenario: ProfitScenario['label']) {
  return scenario;
}

export function buildProfitabilitySummary(input: {
  cropId: CropId;
  regionId: string;
  totalAreaHa: number;
  knownInputCostUsd: number;
  boardStatus: BoardStatus;
}) {
  const market = marketReferences[input.cropId];
  const yieldProfile = yieldProfiles[input.cropId];
  const operatingProfile = operatingCosts[input.cropId];
  const modifier = regionalYieldModifier(input.cropId, input.regionId);
  const operatingCostUsd =
    (operatingProfile.laborPerHa +
      operatingProfile.irrigationPerHa +
      operatingProfile.logisticsPerHa +
      operatingProfile.compliancePerHa +
      operatingProfile.extraPerHa) *
    input.totalAreaHa;
  const totalCostUsd = operatingCostUsd + input.knownInputCostUsd;
  const scenarios = [
    { label: 'Conservative' as const, base: yieldProfile.conservative },
    { label: 'Target' as const, base: yieldProfile.target },
    { label: 'Stretch' as const, base: yieldProfile.stretch },
  ].map<ProfitScenario>((entry) => {
    const yieldPerHa = Number((entry.base * modifier).toFixed(yieldProfile.unit === 'kg' ? 0 : 2));
    const totalOutput = Number((yieldPerHa * input.totalAreaHa).toFixed(yieldProfile.unit === 'kg' ? 0 : 2));
    const grossRevenueUsd =
      market.priceUsd === null ? null : Number((totalOutput * market.priceUsd).toFixed(2));

    return {
      label: entry.label,
      yieldPerHa,
      totalOutput,
      unit: yieldProfile.unit,
      grossRevenueUsd,
      totalCostUsd: Number(totalCostUsd.toFixed(2)),
      netMarginUsd: grossRevenueUsd === null ? null : Number((grossRevenueUsd - totalCostUsd).toFixed(2)),
    };
  });

  const breakEvenYieldPerHa =
    market.priceUsd === null || input.totalAreaHa <= 0
      ? null
      : Number((totalCostUsd / input.totalAreaHa / market.priceUsd).toFixed(yieldProfile.unit === 'kg' ? 0 : 2));
  const targetScenario = scenarios.find((entry) => entry.label === 'Target') ?? scenarios[0];
  const guidance =
    market.priceUsd === null
      ? 'Get the latest buyer contract value before using the profitability model for a selling decision.'
      : input.boardStatus !== 'verified'
        ? 'Link or verify the board record first so price, delivery, and payment planning lines up with the right buyer channel.'
        : targetScenario.netMarginUsd !== null && targetScenario.netMarginUsd > 0
          ? `At the target yield, this crop stays profitable. Keep costs disciplined and protect grade quality to defend margin.`
          : 'At the current estimate, costs are tight. Review input timing, target yield, and buyer channel before committing more spend.';

  return {
    market,
    operatingCostUsd: Number(operatingCostUsd.toFixed(2)),
    totalCostUsd: Number(totalCostUsd.toFixed(2)),
    breakEvenYieldPerHa,
    scenarios,
    guidance,
    assumptionNote: operatingProfile.note,
  } satisfies ProfitabilitySummary;
}

export function buildBoardWorkflow(cropId: CropId, boardStatus: BoardStatus, regionId: string) {
  const boardId = boards.find((board) => board.crops.includes(cropId))?.id ?? 'gmb';
  const cropName = crops.find((crop) => crop.id === cropId)?.name ?? cropId;

  if (boardId === 'timb') {
    return [
      {
        title: 'Grower booking and registration',
        status: boardStatus === 'verified' ? 'ready' : 'action',
        detail: 'TIMB already runs booking, registration, and loan-related systems, so a verified grower record should be the first checkpoint.',
        ctaLabel: 'Open TIMB support',
        url: sourceCatalog.timbHome.url,
      },
      {
        title: 'Daily price matrix',
        status: 'watch',
        detail: 'Monitor the TIMB tobacco price matrix before sending bales so the farmer knows how average floor prices are moving.',
        ctaLabel: 'View price matrix',
        url: sourceCatalog.timbMatrix.url,
      },
      {
        title: 'Nearest tobacco branch',
        status: 'ready',
        detail: `${timbBranchesByRegion[regionId] ?? 'Nearest TIMB branch'} can support grower queries, sales-floor preparation, and paperwork.`,
        ctaLabel: 'Branch contacts',
        url: sourceCatalog.timbContacts.url,
      },
    ] satisfies BoardWorkflowStep[];
  }

  if (boardId === 'sugar-hub') {
    return [
      {
        title: 'Contract confirmation',
        status: boardStatus === 'verified' ? 'ready' : 'action',
        detail: `Because ${cropName} is contract-led, confirm the buyer, delivery slot, and statement terms before relying on sales forecasts.`,
      },
      {
        title: 'Harvest and haulage planning',
        status: 'watch',
        detail: 'Schedule cutting, transport, and weighbridge timing early so cane quality and payment recoveries do not slip.',
      },
      {
        title: 'Extension back-up',
        status: 'ready',
        detail: 'Use Ministry and extension channels if the mill contract terms or cane quality guidance are unclear.',
        ctaLabel: 'Open ministry support',
        url: sourceCatalog.ministry.url,
      },
    ] satisfies BoardWorkflowStep[];
  }

  return [
    {
      title: 'Board verification',
      status: boardStatus === 'verified' ? 'ready' : 'action',
      detail: 'Verify the grower against the board record so the farmer can plan sales with the correct buyer pathway.',
      ctaLabel: 'Check producer prices',
      url: sourceCatalog.gmbPricing.url,
    },
    {
      title: 'Delivery planning',
      status: 'ready',
      detail: 'Map the nearest GMB depot or intake point before harvest so storage and haulage do not become the bottleneck.',
      ctaLabel: 'View depots',
      url: sourceCatalog.gmbDepots.url,
    },
    {
      title: 'Input top-up and logistics',
      status: 'watch',
      detail: 'AgroDura shops at GMB depots can help close late-season input gaps without leaving the delivery route.',
      ctaLabel: 'Open AgroDura',
      url: sourceCatalog.agroDura.url,
    },
  ] satisfies BoardWorkflowStep[];
}

export function buildSupportLinks(cropId: CropId, regionId: string) {
  const regionName = regions.find((region) => region.id === regionId)?.name ?? regionId;
  const cropName = crops.find((crop) => crop.id === cropId)?.name ?? cropId;
  const links: SupportLink[] = [
    {
      kind: 'agronomy',
      name: 'AGRITEX / Ministry extension',
      detail: `Use the Ministry and AGRITEX support channels for field visits, extension help, and official farming guidance in ${regionName}.`,
      contact: 'Head Office +263-242-706081-9',
      url: sourceCatalog.ministryContacts.url,
    },
    {
      kind: 'finance',
      name: 'AFC farm finance',
      detail: `Apply for crop finance, working capital, or irrigation-related funding using the AFC land bank and loan portal.`,
      contact: 'WhatsApp +263712837031',
      url: sourceCatalog.afcLoan.url,
    },
    {
      kind: 'insurance',
      name: 'CBZ Agro Insurance',
      detail: 'Use crop insurance to protect against hail, flood, fire, and other insured production risks.',
      contact: 'Contact Centre +263 8677004050',
      url: sourceCatalog.cbzInsurance.url,
    },
    {
      kind: 'payments',
      name: 'EcoCash merchant payments',
      detail: 'Use merchant payments to settle for inputs, transport, scouting, or local service providers without carrying cash.',
      url: sourceCatalog.ecocashMerchant.url,
    },
  ];

  if (cropId === 'tobacco') {
    links.unshift({
      kind: 'board',
      name: timbBranchesByRegion[regionId] ?? 'TIMB branch support',
      detail: `Use TIMB branch support for ${cropName} booking, branch enquiries, and floor-readiness issues.`,
      contact: 'TIMB +263 8677004624-31',
      url: sourceCatalog.timbContacts.url,
    });
  } else if (cropId === 'maize' || cropId === 'wheat' || cropId === 'soyabean') {
    links.unshift({
      kind: 'board',
      name: 'GMB depot and board support',
      detail: `Use GMB depots and buyer support to plan ${cropName} intake, storage, and delivery timing.`,
      contact: 'GMB +263 8677004941',
      url: sourceCatalog.gmbDepots.url,
    });
  } else {
    links.unshift({
      kind: 'board',
      name: 'Contract buyer support',
      detail: `Keep the buyer statement, weighbridge plan, and transport arrangement aligned for ${cropName}.`,
      url: sourceCatalog.ministry.url,
    });
  }

  return links;
}

export function buildEscalationGuide(input: {
  cropId: CropId;
  regionId: string;
  issue: CropIssue | null;
  note: string;
  diagnosis: CropDiagnosisResult | null;
}) {
  const cropName = crops.find((crop) => crop.id === input.cropId)?.name ?? input.cropId;
  const regionName = regions.find((region) => region.id === input.regionId)?.name ?? input.regionId;
  const issueTitle = input.diagnosis?.issue.title ?? input.issue?.title ?? 'field issue';
  const note = input.note.trim() || 'Farmer has requested support and photo review.';
  const urgentTerms = ['spreading', 'severe', 'wilting', 'dying', 'dead', 'borer', 'mould', 'rapid'];
  const priority =
    input.issue?.category === 'disease' ||
    input.issue?.category === 'pest' ||
    urgentTerms.some((term) => note.toLowerCase().includes(term))
      ? 'urgent'
      : 'routine';

  const channels = buildSupportLinks(input.cropId, input.regionId).filter((link) =>
    ['agronomy', 'board'].includes(link.kind),
  );

  return {
    priority,
    title: priority === 'urgent' ? 'Escalate to agronomist quickly' : 'Escalate to extension support if needed',
    nextAction:
      priority === 'urgent'
        ? 'Send the photo, issue notes, hectares affected, and planting date to AGRITEX or the crop board today.'
        : 'Keep monitoring the field and escalate if symptoms spread beyond the current patch.',
    message: `${cropName} | ${regionName} | Suspected ${issueTitle}. Notes: ${note}`,
    channels,
  } satisfies EscalationGuide;
}

export function getBoardMarketReferences(boardId: BoardId) {
  const boardCropIds = boards.find((board) => board.id === boardId)?.crops ?? [];
  return boardCropIds.map((cropId) => marketReferences[cropId]);
}

export function formatMarketValue(value: number | null, unit: MarketUnit) {
  if (value === null) {
    return 'Contract quote needed';
  }

  return unit === 'kg' ? `US$${value.toFixed(2)}/${unit}` : `US$${value.toFixed(2)}/${unit}`;
}

export function formatOutput(value: number, unit: MarketUnit) {
  if (unit === 'kg') {
    return `${value.toFixed(0)} ${unit}`;
  }

  return `${value.toFixed(2)} ${unit}`;
}

export function formatScenarioLabel(label: ProfitScenario['label']) {
  return scenarioLabel(label);
}
