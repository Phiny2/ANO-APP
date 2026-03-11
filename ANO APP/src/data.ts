export type Country = 'Zimbabwe' | 'Eswatini';
export type CropId = 'maize' | 'tobacco' | 'wheat' | 'sugarcane' | 'soyabean';
export type BoardId = 'gmb' | 'timb' | 'sugar-hub';
export type AdvisoryKind = 'fertiliser' | 'irrigation' | 'protection';

export interface RegionConfig {
  id: string;
  country: Country;
  name: string;
  rainfallPattern: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  crops: CropId[];
}

export interface VarietyRecommendation {
  name: string;
  fit: string;
  countries?: Country[];
  regionIds?: string[];
}

export interface ScheduleTask {
  title: string;
  kind: AdvisoryKind;
  dayOffset: number;
  stage: string;
  note: string;
  input?: string;
  amount?: string;
}

export interface CropIssue {
  id: string;
  category: 'weed' | 'pest' | 'disease' | 'nutrition';
  title: string;
  signs: string;
  recommendation: string;
  product: string;
}

export interface CropGuide {
  id: CropId;
  name: string;
  boardId: BoardId;
  icon: string;
  summary: string;
  varieties: VarietyRecommendation[];
  irrigationPlan: string;
  schedule: ScheduleTask[];
  issues: CropIssue[];
}

export interface BoardConfig {
  id: BoardId;
  name: string;
  crops: CropId[];
  farmerPrompt: string;
  growerIdLabel: string;
  portalHint: string;
}

export interface GrowerRegistryRecord {
  boardId: BoardId;
  cropId: CropId;
  name: string;
  regionId: string;
  growerId: string;
  pin: string;
  status: 'verified' | 'linked';
}

export interface BoardUser {
  boardId: BoardId;
  username: string;
  password: string;
  displayName: string;
}

export interface AgronomistSpecialty {
  id: string;
  label: string;
  summary: string;
  cropIds?: CropId[];
  issueCategories?: CropIssue['category'][];
}

export interface AgronomistUser {
  username: string;
  password: string;
  email: string;
  displayName: string;
  country: Country;
  regionId: string;
  locationDetail: string;
  whatsappNumber: string;
  availabilityStatus: 'available' | 'busy' | 'field-visit';
  specializationIds: string[];
}

export const regions: RegionConfig[] = [
  {
    id: 'mash-west',
    country: 'Zimbabwe',
    name: 'Mashonaland West',
    rainfallPattern: 'High-potential summer rainfall with strong maize and tobacco windows.',
    coordinates: { lat: -17.37, lon: 30.2 },
    crops: ['maize', 'tobacco', 'wheat', 'soyabean'],
  },
  {
    id: 'mash-central',
    country: 'Zimbabwe',
    name: 'Mashonaland Central',
    rainfallPattern: 'Reliable rainfall for maize, tobacco and rotation crops.',
    coordinates: { lat: -16.76, lon: 31.01 },
    crops: ['maize', 'tobacco', 'soyabean'],
  },
  {
    id: 'mash-east',
    country: 'Zimbabwe',
    name: 'Mashonaland East',
    rainfallPattern: 'Mixed rainfall zones suited to maize, tobacco and irrigated wheat.',
    coordinates: { lat: -18.19, lon: 31.55 },
    crops: ['maize', 'tobacco', 'wheat', 'soyabean'],
  },
  {
    id: 'midlands',
    country: 'Zimbabwe',
    name: 'Midlands',
    rainfallPattern: 'Balanced rainfall where maize and wheat need tight irrigation planning.',
    coordinates: { lat: -19.45, lon: 29.82 },
    crops: ['maize', 'wheat', 'soyabean'],
  },
  {
    id: 'manicaland',
    country: 'Zimbabwe',
    name: 'Manicaland',
    rainfallPattern: 'Humid eastern conditions support tobacco, maize and selected cane belts.',
    coordinates: { lat: -18.92, lon: 32.17 },
    crops: ['maize', 'tobacco', 'wheat', 'sugarcane'],
  },
  {
    id: 'masvingo-lowveld',
    country: 'Zimbabwe',
    name: 'Masvingo Lowveld',
    rainfallPattern: 'Hot lowveld climate where irrigation discipline drives cane and wheat results.',
    coordinates: { lat: -21.04, lon: 31.67 },
    crops: ['maize', 'wheat', 'sugarcane'],
  },
  {
    id: 'mat-north',
    country: 'Zimbabwe',
    name: 'Matabeleland North',
    rainfallPattern: 'Drier conditions make moisture conservation and irrigation timing critical.',
    coordinates: { lat: -18.53, lon: 27.29 },
    crops: ['maize', 'wheat', 'soyabean'],
  },
  {
    id: 'mat-south',
    country: 'Zimbabwe',
    name: 'Matabeleland South',
    rainfallPattern: 'Lower rainfall favors drought-aware maize and carefully planned winter wheat.',
    coordinates: { lat: -21.05, lon: 29.37 },
    crops: ['maize', 'wheat'],
  },
  {
    id: 'eswatini-lowveld',
    country: 'Eswatini',
    name: 'Eswatini Lowveld',
    rainfallPattern: 'Warm irrigated cane country with smaller maize and wheat windows.',
    coordinates: { lat: -26.54, lon: 31.98 },
    crops: ['sugarcane', 'maize', 'wheat'],
  },
];

export const boards: BoardConfig[] = [
  {
    id: 'gmb',
    name: 'GMB Buyer Hub',
    crops: ['maize', 'wheat', 'soyabean'],
    farmerPrompt: 'Connect your Grain Marketing Board grower details to unlock full planning.',
    growerIdLabel: 'GMB grower number',
    portalHint: 'Use the board portal to monitor maize, wheat and soyabean growers.',
  },
  {
    id: 'timb',
    name: 'TIMB Tobacco Portal',
    crops: ['tobacco'],
    farmerPrompt: 'Connect your TIMB grower profile before you proceed with tobacco guidance.',
    growerIdLabel: 'TIMB grower number',
    portalHint: 'Track registered tobacco growers and pending verifications.',
  },
  {
    id: 'sugar-hub',
    name: 'Sugar Buyer Contract Hub',
    crops: ['sugarcane'],
    farmerPrompt: 'Link your cane contract or buyer record to continue with sugarcane planning.',
    growerIdLabel: 'Contract or grower ID',
    portalHint: 'Review cane growers by lowveld region and contract status.',
  },
];

export const boardUsers: BoardUser[] = [
  {
    boardId: 'gmb',
    username: 'gmb.manager',
    password: 'harvest2026',
    displayName: 'GMB Operations Manager',
  },
  {
    boardId: 'timb',
    username: 'timb.officer',
    password: 'leaf2026',
    displayName: 'TIMB Registration Officer',
  },
  {
    boardId: 'sugar-hub',
    username: 'cane.admin',
    password: 'cane2026',
    displayName: 'Sugar Buyer Contract Lead',
  },
];

export const agronomistSpecialties: AgronomistSpecialty[] = [
  {
    id: 'grain-production',
    label: 'Grain production',
    summary: 'Maize, wheat, and soyabean establishment, nutrition, and harvest planning.',
    cropIds: ['maize', 'wheat', 'soyabean'],
  },
  {
    id: 'tobacco-quality',
    label: 'Tobacco quality',
    summary: 'Transplanting, disease pressure, topping, curing, and sale-floor readiness.',
    cropIds: ['tobacco'],
  },
  {
    id: 'sugarcane-management',
    label: 'Sugarcane management',
    summary: 'Lowveld cane establishment, ratoon management, irrigation, and contract harvest flow.',
    cropIds: ['sugarcane'],
  },
  {
    id: 'pest-control',
    label: 'Pest control',
    summary: 'Field scouting, pest thresholds, and Zimbabwe-approved control programs.',
    issueCategories: ['pest'],
  },
  {
    id: 'weed-and-herbicide',
    label: 'Weed and herbicide',
    summary: 'Weed pressure diagnosis, herbicide selection, and crop-safe timing.',
    issueCategories: ['weed'],
  },
  {
    id: 'soil-and-nutrition',
    label: 'Soil and nutrition',
    summary: 'Fertiliser planning, deficiency diagnosis, and soil-health support.',
    issueCategories: ['nutrition'],
  },
  {
    id: 'disease-response',
    label: 'Disease response',
    summary: 'Rapid disease scouting, product selection, and field containment plans.',
    issueCategories: ['disease'],
  },
  {
    id: 'irrigation-and-water',
    label: 'Irrigation and water',
    summary: 'Irrigation scheduling, water stress recovery, and weather-aware timing.',
  },
];

export const agronomistUsers: AgronomistUser[] = [
  {
    username: 'agri.moyo',
    password: 'soil2026',
    email: 'agri.moyo@ano.demo',
    displayName: 'Dr. Nyarai Moyo',
    country: 'Zimbabwe',
    regionId: 'mash-west',
    locationDetail: 'Chinhoyi service corridor',
    whatsappNumber: '+263771240510',
    availabilityStatus: 'available',
    specializationIds: ['grain-production', 'soil-and-nutrition', 'weed-and-herbicide'],
  },
  {
    username: 'leaf.ncube',
    password: 'leafcare2026',
    email: 'leaf.ncube@ano.demo',
    displayName: 'Sibusiso Ncube',
    country: 'Zimbabwe',
    regionId: 'mash-central',
    locationDetail: 'Bindura tobacco cluster',
    whatsappNumber: '+263774681210',
    availabilityStatus: 'field-visit',
    specializationIds: ['tobacco-quality', 'disease-response', 'pest-control'],
  },
  {
    username: 'cane.dlamini',
    password: 'caneguard2026',
    email: 'cane.dlamini@ano.demo',
    displayName: 'Lindiwe Dlamini',
    country: 'Eswatini',
    regionId: 'eswatini-lowveld',
    locationDetail: 'Big Bend irrigation belt',
    whatsappNumber: '+26876114522',
    availabilityStatus: 'available',
    specializationIds: ['sugarcane-management', 'irrigation-and-water', 'pest-control'],
  },
  {
    username: 'delta.chikowore',
    password: 'water2026',
    email: 'delta.chikowore@ano.demo',
    displayName: 'Farai Chikowore',
    country: 'Zimbabwe',
    regionId: 'masvingo-lowveld',
    locationDetail: 'Triangle and Hippo Valley support desk',
    whatsappNumber: '+263772441889',
    availabilityStatus: 'busy',
    specializationIds: ['sugarcane-management', 'irrigation-and-water', 'soil-and-nutrition'],
  },
];

export const growerRegistry: GrowerRegistryRecord[] = [
  {
    boardId: 'gmb',
    cropId: 'maize',
    name: 'Tendai Moyo',
    regionId: 'mash-west',
    growerId: 'GMB-1048',
    pin: '2468',
    status: 'verified',
  },
  {
    boardId: 'gmb',
    cropId: 'wheat',
    name: 'Agness Ncube',
    regionId: 'midlands',
    growerId: 'GMB-2204',
    pin: '7842',
    status: 'verified',
  },
  {
    boardId: 'timb',
    cropId: 'tobacco',
    name: 'Blessing Dube',
    regionId: 'mash-central',
    growerId: 'TIMB-4431',
    pin: '1188',
    status: 'verified',
  },
  {
    boardId: 'sugar-hub',
    cropId: 'sugarcane',
    name: 'Sipho Dlamini',
    regionId: 'eswatini-lowveld',
    growerId: 'SUG-9012',
    pin: '5521',
    status: 'verified',
  },
  {
    boardId: 'sugar-hub',
    cropId: 'sugarcane',
    name: 'Farai Chikowore',
    regionId: 'masvingo-lowveld',
    growerId: 'SUG-7024',
    pin: '3377',
    status: 'verified',
  },
];

export const crops: CropGuide[] = [
  {
    id: 'maize',
    name: 'Maize',
    boardId: 'gmb',
    icon: 'Mz',
    summary: 'Region-aware variety selection, basal and top-dressing timing, and weed control alerts.',
    irrigationPlan:
      'Irrigate lightly after planting, then every 5 to 8 days in sandy soils or every 7 to 10 days in heavier soils unless rainfall resets soil moisture.',
    varieties: [
      {
        name: 'SC 513',
        fit: 'Widely available hybrid for Zimbabwean maize belts where growers want a dependable medium-maturity option.',
        regionIds: ['mash-west', 'mash-central', 'mash-east', 'midlands', 'manicaland'],
      },
      {
        name: 'SC 727',
        fit: 'Best for high-potential Zimbabwean regions with strong rainfall and good fertility.',
        regionIds: ['mash-west', 'mash-central', 'mash-east'],
      },
      {
        name: 'PAN 53',
        fit: 'Balanced hybrid for Mashonaland and Midlands where rainfall is decent but timing matters.',
        regionIds: ['mash-east', 'midlands', 'manicaland'],
      },
      {
        name: 'ZM 521',
        fit: 'More drought-tolerant option for the drier Matabeleland belts.',
        regionIds: ['mat-north', 'mat-south'],
      },
      {
        name: 'PHB 30G19',
        fit: 'Suitable for warmer Eswatini lowveld conditions when irrigation support is available.',
        countries: ['Eswatini'],
      },
    ],
    schedule: [
      {
        title: 'Planting and basal dressing',
        kind: 'fertiliser',
        dayOffset: 0,
        stage: 'Planting',
        input: 'Compound D or basal blend',
        amount: '250 to 350 kg/ha',
        note: 'Place fertiliser away from the seed line and plant into moist soil.',
      },
      {
        title: 'First weed control pass',
        kind: 'protection',
        dayOffset: 10,
        stage: 'Emergence',
        input: 'Pre- or early post-emergence herbicide',
        note: 'Spray when weeds are young and avoid drift onto nearby crops.',
      },
      {
        title: 'Top dressing',
        kind: 'fertiliser',
        dayOffset: 21,
        stage: '3 to 5 leaf stage',
        input: 'Ammonium nitrate',
        amount: '150 to 200 kg/ha',
        note: 'Delay if heavy rainfall is expected within 24 hours to reduce leaching losses.',
      },
      {
        title: 'Mid-season irrigation review',
        kind: 'irrigation',
        dayOffset: 30,
        stage: 'Vegetative growth',
        note: 'Increase frequency in sandy soils and reduce if cumulative rainfall is strong.',
      },
      {
        title: 'Second nutrition check',
        kind: 'fertiliser',
        dayOffset: 42,
        stage: 'Tasselling approach',
        input: 'Foliar zinc or nitrogen support if crop shows stress',
        note: 'Use leaf colour and plant vigor to guide the top-up decision.',
      },
    ],
    issues: [
      {
        id: 'fall-armyworm',
        category: 'pest',
        title: 'Fall armyworm',
        signs: 'Ragged leaves, frass in the whorl and rapid chewing damage.',
        recommendation: 'Scout early, spray the whorl directly and repeat only when threshold pressure remains high.',
        product: 'Emamectin benzoate or spinetoram-based control',
      },
      {
        id: 'broadleaf-weeds',
        category: 'weed',
        title: 'Broadleaf and grass weeds',
        signs: 'Competition in the first three weeks after emergence.',
        recommendation: 'Use a labelled early post-emergence herbicide and keep rows clean before canopy closure.',
        product: 'Atrazine mixes or region-approved post-emergence blend',
      },
      {
        id: 'nitrogen-deficiency',
        category: 'nutrition',
        title: 'Nitrogen deficiency',
        signs: 'Pale lower leaves and weak vegetative growth.',
        recommendation: 'Confirm moisture status first, then top dress or foliar-feed depending on crop stage.',
        product: 'Ammonium nitrate or balanced foliar feed',
      },
    ],
  },
  {
    id: 'tobacco',
    name: 'Tobacco',
    boardId: 'timb',
    icon: 'Tb',
    summary: 'Focuses on variety fit, sucker management, disease scouting and staged feeding.',
    irrigationPlan:
      'Maintain even moisture after transplanting, then irrigate in lighter, more frequent cycles to avoid leaf quality losses.',
    varieties: [
      {
        name: 'KRK 26',
        fit: 'Reliable flue-cured option for core Zimbabwe tobacco belts.',
        regionIds: ['mash-west', 'mash-central', 'mash-east', 'manicaland'],
      },
      {
        name: 'T66',
        fit: 'Suitable where growers need strong leaf quality under disciplined management.',
        regionIds: ['mash-west', 'mash-east'],
      },
      {
        name: 'LK 37',
        fit: 'Works in wetter eastern zones where disease monitoring remains strong.',
        regionIds: ['manicaland'],
      },
    ],
    schedule: [
      {
        title: 'Transplant starter feed',
        kind: 'fertiliser',
        dayOffset: 0,
        stage: 'Transplanting',
        input: 'Tobacco basal fertiliser',
        amount: '700 to 900 kg/ha',
        note: 'Apply into moist ridges and avoid direct contact with roots.',
      },
      {
        title: 'Pest and disease scouting',
        kind: 'protection',
        dayOffset: 7,
        stage: 'Early establishment',
        note: 'Inspect lower leaves and undersides before pressure builds.',
      },
      {
        title: 'Top dressing and irrigation check',
        kind: 'fertiliser',
        dayOffset: 18,
        stage: 'Rapid vegetative growth',
        input: 'CAN or approved tobacco top dressing',
        amount: '150 kg/ha split if needed',
        note: 'Hold application if rainfall or waterlogging is likely tomorrow.',
      },
      {
        title: 'Sucker control window',
        kind: 'protection',
        dayOffset: 42,
        stage: 'After topping',
        input: 'Registered sucker control solution',
        note: 'Apply quickly after topping to protect leaf quality.',
      },
    ],
    issues: [
      {
        id: 'aphids',
        category: 'pest',
        title: 'Aphids',
        signs: 'Sticky honeydew, curled leaves and visible colonies on softer tissue.',
        recommendation: 'Treat hot spots early and monitor for virus spread.',
        product: 'Imidacloprid or other labelled systemic option',
      },
      {
        id: 'blue-mould',
        category: 'disease',
        title: 'Blue mould risk',
        signs: 'Yellow patches and grey-blue mould under humid conditions.',
        recommendation: 'Improve airflow, avoid overhead irrigation late in the day and use a labelled fungicide.',
        product: 'Metalaxyl-based fungicide where approved',
      },
      {
        id: 'nutsedge',
        category: 'weed',
        title: 'Nutsedge and small broadleaves',
        signs: 'Persistent weeds on ridges competing for moisture.',
        recommendation: 'Use a tobacco-safe herbicide or manual control before weeds harden off.',
        product: 'Registered tobacco herbicide program',
      },
    ],
  },
  {
    id: 'wheat',
    name: 'Wheat',
    boardId: 'gmb',
    icon: 'Wh',
    summary: 'Winter wheat scheduling built around irrigation frequency, feeding stages and rust vigilance.',
    irrigationPlan:
      'Plan a first irrigation immediately after planting, then every 7 to 10 days early on and every 5 to 7 days from tillering to grain fill depending on soil and weather.',
    varieties: [
      {
        name: 'SC Nduna',
        fit: 'Strong winter option for irrigated Zimbabwean wheat blocks.',
        regionIds: ['mash-west', 'midlands', 'mash-east'],
      },
      {
        name: 'SC Select',
        fit: 'Good for disciplined irrigators looking for stable grain performance.',
        regionIds: ['midlands', 'manicaland', 'mat-north', 'mat-south'],
      },
      {
        name: 'SST 88',
        fit: 'Useful for warmer irrigated belts and lowveld schemes.',
        regionIds: ['masvingo-lowveld', 'eswatini-lowveld'],
      },
    ],
    schedule: [
      {
        title: 'Planting irrigation',
        kind: 'irrigation',
        dayOffset: 0,
        stage: 'Planting',
        note: 'Ensure good stand establishment with an even profile wetting.',
      },
      {
        title: 'Basal fertiliser placement',
        kind: 'fertiliser',
        dayOffset: 0,
        stage: 'Planting',
        input: 'Compound basal blend',
        amount: '300 to 400 kg/ha',
        note: 'Place the fertiliser below and beside the seed.',
      },
      {
        title: 'Tillering top dressing',
        kind: 'fertiliser',
        dayOffset: 21,
        stage: 'Tillering',
        input: 'Nitrogen top dressing',
        amount: '100 to 150 kg/ha',
        note: 'Split dressings are safer where irrigation or rainfall is uncertain.',
      },
      {
        title: 'Rust scouting',
        kind: 'protection',
        dayOffset: 28,
        stage: 'Canopy build',
        note: 'Inspect leaves twice weekly once nights cool and humidity rises.',
      },
      {
        title: 'Booting irrigation focus',
        kind: 'irrigation',
        dayOffset: 45,
        stage: 'Booting to flowering',
        note: 'Avoid moisture stress during booting and grain set.',
      },
    ],
    issues: [
      {
        id: 'rust',
        category: 'disease',
        title: 'Leaf rust or stripe rust',
        signs: 'Orange or yellow pustules spreading quickly across leaves.',
        recommendation: 'Act immediately with a rust fungicide and maintain scouting intervals.',
        product: 'Triazole or triazole-strobilurin fungicide',
      },
      {
        id: 'wild-oats',
        category: 'weed',
        title: 'Wild oats and annual grasses',
        signs: 'Fast-growing grasses outcompeting the crop in rows.',
        recommendation: 'Spray at the recommended leaf stage and keep irrigation intervals steady.',
        product: 'Selective grass herbicide labelled for wheat',
      },
      {
        id: 'nitrogen-loss',
        category: 'nutrition',
        title: 'Nitrogen loss after heavy watering',
        signs: 'Patchy yellowing after rainfall or over-irrigation.',
        recommendation: 'Review the irrigation interval and consider split top dressing.',
        product: 'Nitrogen top-up or balanced foliar support',
      },
    ],
  },
  {
    id: 'sugarcane',
    name: 'Sugarcane',
    boardId: 'sugar-hub',
    icon: 'Sc',
    summary: 'Supports lowveld cane blocks with region-specific variety fit, fertigation and ratoon timing.',
    irrigationPlan:
      'In hot lowveld conditions, irrigate every 5 to 7 days on lighter soils and every 7 to 10 days on heavier soils, adjusting when rainfall exceeds planned application.',
    varieties: [
      {
        name: 'ZN10',
        fit: 'A Zimbabwe lowveld fit for commercial cane blocks requiring strong ratoon vigor.',
        regionIds: ['masvingo-lowveld'],
      },
      {
        name: 'N41',
        fit: 'Commonly suited to irrigated lowveld conditions with good recovery under heat.',
        regionIds: ['masvingo-lowveld', 'manicaland'],
      },
      {
        name: 'N54',
        fit: 'Useful in Eswatini lowveld schemes where maturity timing differs from Zimbabwe blocks.',
        regionIds: ['eswatini-lowveld'],
      },
      {
        name: 'N25',
        fit: 'Alternative Eswatini cane type for irrigated estates and outgrower contracts.',
        countries: ['Eswatini'],
      },
    ],
    schedule: [
      {
        title: 'Sett placement and starter feed',
        kind: 'fertiliser',
        dayOffset: 0,
        stage: 'Planting',
        input: 'Cane basal fertiliser',
        amount: '450 to 600 kg/ha',
        note: 'Band the feed below the setts and irrigate soon after planting.',
      },
      {
        title: 'Stand count and weed control',
        kind: 'protection',
        dayOffset: 21,
        stage: 'Early tillering',
        note: 'Clean the rows early to protect stand uniformity.',
      },
      {
        title: 'Nitrogen side dressing',
        kind: 'fertiliser',
        dayOffset: 45,
        stage: 'Tillering',
        input: 'Urea or cane nitrogen blend',
        amount: '180 to 250 kg/ha',
        note: 'Move the application if strong rain is due within the next day.',
      },
      {
        title: 'Irrigation rhythm review',
        kind: 'irrigation',
        dayOffset: 60,
        stage: 'Grand growth',
        note: 'This is the period where skipped irrigations quickly reduce stalk growth.',
      },
    ],
    issues: [
      {
        id: 'borer',
        category: 'pest',
        title: 'Stalk borer',
        signs: 'Shot holes, dead hearts and boring damage in younger cane.',
        recommendation: 'Target fields early and remove heavily infested stools where necessary.',
        product: 'Registered cane insecticide program',
      },
      {
        id: 'smut',
        category: 'disease',
        title: 'Sugarcane smut',
        signs: 'Whip-like black structures and weak stooling.',
        recommendation: 'Rogue affected stools, keep seed material clean and rotate susceptible blocks.',
        product: 'Sanitation and clean seed program',
      },
      {
        id: 'grass-weeds',
        category: 'weed',
        title: 'Grass weeds in young cane',
        signs: 'Rapid grass competition along furrows and inter-rows.',
        recommendation: 'Use an early cane-safe herbicide and prevent seed set.',
        product: 'Registered pre- or post-emergence cane herbicide',
      },
    ],
  },
  {
    id: 'soyabean',
    name: 'Soyabean',
    boardId: 'gmb',
    icon: 'Sy',
    summary: 'Rotation-friendly crop guidance with inoculation, feeding and rust-aware management.',
    irrigationPlan:
      'Maintain even moisture during establishment and flowering, then tighten irrigation at pod fill if rainfall drops.',
    varieties: [
      {
        name: 'Safari',
        fit: 'Good general soyabean option for Mashonaland and Midlands rotation systems.',
        regionIds: ['mash-west', 'mash-central', 'mash-east', 'midlands'],
      },
      {
        name: 'Serenade',
        fit: 'Useful where growers need a stable medium-maturing line.',
        regionIds: ['manicaland', 'midlands'],
      },
    ],
    schedule: [
      {
        title: 'Seed inoculation and planting',
        kind: 'fertiliser',
        dayOffset: 0,
        stage: 'Planting',
        input: 'Rhizobium inoculant plus starter phosphorus',
        note: 'Protect inoculant from direct sun and plant quickly.',
      },
      {
        title: 'Early weed clean-up',
        kind: 'protection',
        dayOffset: 14,
        stage: 'Vegetative growth',
        note: 'Keep weeds down before canopy closes.',
      },
      {
        title: 'Flowering moisture check',
        kind: 'irrigation',
        dayOffset: 35,
        stage: 'Flowering',
        note: 'Moisture stress at flowering can sharply reduce pods.',
      },
      {
        title: 'Pod-fill nutrition review',
        kind: 'fertiliser',
        dayOffset: 50,
        stage: 'Pod fill',
        input: 'Foliar potassium and trace support if required',
        note: 'Use tissue symptoms and field history to guide the decision.',
      },
    ],
    issues: [
      {
        id: 'soy-rust',
        category: 'disease',
        title: 'Soyabean rust',
        signs: 'Tiny brown lesions and rapid defoliation if ignored.',
        recommendation: 'Scout lower canopy leaves and spray early if the disease is confirmed.',
        product: 'Rust fungicide program',
      },
      {
        id: 'pod-sucking-bugs',
        category: 'pest',
        title: 'Pod sucking bugs',
        signs: 'Pod scarring and poor seed fill.',
        recommendation: 'Spray at threshold and reduce nearby weed hosts.',
        product: 'Registered broad-spectrum insecticide',
      },
    ],
  },
];
