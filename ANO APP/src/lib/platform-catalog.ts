import type {
  BoardIntegrationRecord,
  MobileReleaseItem,
  SupplierOfferRecord,
} from './app-types';

export interface DemoAdminUser {
  username: string;
  password: string;
  email: string;
  displayName: string;
}

export const demoAdminUsers: DemoAdminUser[] = [
  {
    username: 'national.admin',
    password: 'anosuite2026',
    email: 'national.admin@ano.demo',
    displayName: 'ANO National Platform Admin',
  },
];

export const supplierOffers: SupplierOfferRecord[] = [
  {
    id: 'maize-seed-zbms',
    cropId: 'maize',
    category: 'seed',
    supplierName: 'ZBMS',
    productName: 'SC 513 seed maize',
    unitLabel: '10 kg pack',
    unitPriceUsd: 14.8,
    stockStatus: 'in-stock',
    note: 'Widely available hybrid seed for core maize belts.',
    url: 'https://www.zbms.co.zw/shop/agriculture/seeds/seedsa07-10kg-sc-513-gls-2/',
  },
  {
    id: 'maize-fert-zbms',
    cropId: 'maize',
    category: 'fertiliser',
    supplierName: 'ZBMS',
    productName: 'Compound D 50 kg',
    unitLabel: '50 kg bag',
    unitPriceUsd: 32.5,
    stockStatus: 'in-stock',
    note: 'Starter fertiliser used for basal dressing plans.',
    url: 'https://www.zbms.co.zw/shop/agriculture/fertilizer/ferta03-50kg-zfc-maize-fert-compound-d-7147/',
  },
  {
    id: 'wheat-seed-seedco',
    cropId: 'wheat',
    category: 'seed',
    supplierName: 'Seed Co Online Shop',
    productName: 'SC Nduna wheat seed',
    unitLabel: '25 kg bag',
    unitPriceUsd: 30,
    stockStatus: 'limited',
    note: 'Irrigated wheat option for winter crop programs.',
    url: 'https://www.seedcoonlineshop.com/zw/product/sc-nduna/',
  },
  {
    id: 'tobacco-seed-kutsaga',
    cropId: 'tobacco',
    category: 'seed',
    supplierName: 'Kutsaga Shop',
    productName: 'Tobacco seed and support inputs',
    unitLabel: 'catalogue item',
    unitPriceUsd: 0,
    stockStatus: 'quote',
    note: 'Order and price depend on the selected tobacco programme.',
    url: 'https://kutsaga.co.zw/shop/',
  },
  {
    id: 'herbicide-dublon',
    cropId: 'maize',
    category: 'herbicide',
    supplierName: 'Tiger Agro Chem',
    productName: 'Dublon Super herbicide',
    unitLabel: 'pack',
    unitPriceUsd: 22,
    stockStatus: 'in-stock',
    note: 'Used in weed-control support workflows.',
    url: 'https://www.tigeragrochem.co.zw/product-page/dublon-super-herbicide',
  },
  {
    id: 'service-spray-team',
    cropId: 'maize',
    category: 'services',
    supplierName: 'ANO Field Service Network',
    productName: 'Contract spray team',
    unitLabel: 'visit',
    unitPriceUsd: 65,
    stockStatus: 'limited',
    note: 'Useful for larger farms that need rapid pest or weed response.',
    url: 'https://www.agric.gov.zw/',
  },
];

export const defaultBoardIntegrations: BoardIntegrationRecord[] = [
  {
    id: 'gmb-registry',
    label: 'GMB grower registry API',
    boardId: 'gmb',
    status: 'warning',
    provider: 'In-app board workflow',
    summary: 'Verification screens are live, but direct registry sync still needs credentials and endpoint mapping.',
    endpoint: 'https://gmbdura.co.zw/',
    lastSyncAt: '2026-03-10T08:00:00.000Z',
  },
  {
    id: 'timb-bookings',
    label: 'TIMB sales and booking sync',
    boardId: 'timb',
    status: 'planned',
    provider: 'In-app board workflow',
    summary: 'Board workflow is implemented, but live booking and payment status still need API contracts.',
    endpoint: 'https://www.timb.co.zw/',
  },
  {
    id: 'sugar-contracts',
    label: 'Sugar contract sync',
    boardId: 'sugar-hub',
    status: 'connected',
    provider: 'In-app board workflow',
    summary: 'Contract-style cane workflow is active in-app and ready for live endpoint swapping.',
    endpoint: 'https://www.agric.gov.zw/',
    lastSyncAt: '2026-03-10T08:15:00.000Z',
  },
  {
    id: 'diagnosis-engine',
    label: 'AI diagnosis engine',
    status: 'warning',
    provider: 'Local crop guide fallback',
    summary: 'Camera flow is live, but full image diagnosis depends on the configured diagnosis API.',
  },
  {
    id: 'agronomist-dispatch',
    label: 'Agronomist case dispatch',
    status: 'planned',
    provider: 'In-app case queue',
    summary: 'Farmer enquiries and agronomist responses are managed in-app and ready for a live escalation endpoint.',
  },
  {
    id: 'push-campaigns',
    label: 'Push notification campaigns',
    status: 'planned',
    provider: 'Browser and device alerts',
    summary: 'Local device alerts are active. FCM and APNs server delivery is still pending platform keys.',
  },
  {
    id: 'payments-gateway',
    label: 'Payments gateway',
    status: 'planned',
    provider: 'Manual payment capture',
    summary: 'EcoCash, bank, and card flows are modeled in-app and ready for provider integration.',
  },
];

export const mobileReleaseChecklist: MobileReleaseItem[] = [
  {
    id: 'store-copy',
    title: 'Store copy and screenshots',
    detail: 'Prepare Play Store and App Store descriptions, privacy copy, and localized screenshots.',
    status: 'in-progress',
  },
  {
    id: 'app-icons',
    title: 'App icon and splash pack',
    detail: 'Generate final launcher icons, splash assets, and brand-safe mobile artwork.',
    status: 'pending',
  },
  {
    id: 'push-keys',
    title: 'Push credentials',
    detail: 'Add Firebase Cloud Messaging and Apple Push Notification keys for server-driven reminders.',
    status: 'pending',
  },
  {
    id: 'qa-devices',
    title: 'Field QA on devices',
    detail: 'Test camera capture, offline workflows, sync, and weather flows on Android and iPhone hardware.',
    status: 'in-progress',
  },
];
