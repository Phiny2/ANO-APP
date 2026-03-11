import type { BudgetSummary } from './economics';
import { cacheGet, cacheSet } from './cache';
import {
  type AgronomistCaseRecord,
  type BoardIntegrationRecord,
  type HarvestRecord,
  type MarketplaceOrderLine,
  type MarketplaceOrderRecord,
  type MobileReleaseItem,
  type PaymentMethod,
  type PaymentRecord,
  type UserProfile,
} from './app-types';
import {
  createGatewayPaymentSession,
  getConfiguredIntegrationRecords,
  syncAgronomistCaseToGateway,
} from './integrations';
import { mobileReleaseChecklist } from './platform-catalog';

const casesKey = 'ano-ops-cases';
const ordersKey = 'ano-ops-orders';
const paymentsKey = 'ano-ops-payments';
const harvestsKey = 'ano-ops-harvests';
const integrationsKey = 'ano-ops-integrations';
const mobileChecklistKey = 'ano-mobile-release';

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function readCases() {
  return cacheGet<AgronomistCaseRecord[]>(casesKey, []);
}

function writeCases(records: AgronomistCaseRecord[]) {
  cacheSet(casesKey, records);
}

function readOrders() {
  return cacheGet<MarketplaceOrderRecord[]>(ordersKey, []);
}

function writeOrders(records: MarketplaceOrderRecord[]) {
  cacheSet(ordersKey, records);
}

function readPayments() {
  return cacheGet<PaymentRecord[]>(paymentsKey, []);
}

function writePayments(records: PaymentRecord[]) {
  cacheSet(paymentsKey, records);
}

function readHarvests() {
  return cacheGet<HarvestRecord[]>(harvestsKey, []);
}

function writeHarvests(records: HarvestRecord[]) {
  cacheSet(harvestsKey, records);
}

function readIntegrations() {
  const configured = getConfiguredIntegrationRecords();
  const overrides = cacheGet<BoardIntegrationRecord[]>(integrationsKey, []);

  const merged = configured.map((record) => {
    const override = overrides.find((entry) => entry.id === record.id);
    if (!override) {
      return record;
    }

    return {
      ...record,
      ...override,
      configured: record.configured,
      mode: record.mode,
      provider: record.provider,
      endpoint: record.endpoint,
      requirements: record.requirements,
    };
  });

  return [
    ...merged,
    ...overrides.filter((override) => !configured.some((record) => record.id === override.id)),
  ];
}

function writeIntegrations(records: BoardIntegrationRecord[]) {
  cacheSet(integrationsKey, records);
}

function readMobileChecklist() {
  return cacheGet<MobileReleaseItem[]>(mobileChecklistKey, mobileReleaseChecklist);
}

function writeMobileChecklist(records: MobileReleaseItem[]) {
  cacheSet(mobileChecklistKey, records);
}

export function syncCasesFromEnquiries(input: {
  farmer: UserProfile;
  enquiries: Array<{
    id: string;
    cropId: AgronomistCaseRecord['cropId'];
    boardId: AgronomistCaseRecord['boardId'];
    issueId: string;
    note: string;
    imageUrl?: string;
    createdAt: string;
  }>;
}) {
  const existing = readCases();
  const next = [...existing];

  input.enquiries.forEach((enquiry) => {
    const foundIndex = next.findIndex((record) => record.id === enquiry.id);
    const priority = /armyworm|borer|smut|rust|mould|wilt|severe|urgent/i.test(enquiry.note) ? 'urgent' : 'normal';
    const baseRecord: AgronomistCaseRecord = {
      id: enquiry.id,
      farmerId: input.farmer.id,
      farmerName: input.farmer.fullName,
      farmerEmail: input.farmer.email,
      regionId: input.farmer.regionId,
      cropId: enquiry.cropId,
      boardId: enquiry.boardId,
      issueId: enquiry.issueId,
      note: enquiry.note,
      imageUrl: enquiry.imageUrl,
      createdAt: enquiry.createdAt,
      caseStatus: 'new',
      priority,
      updatedAt: enquiry.createdAt,
    };

    if (foundIndex >= 0) {
      next[foundIndex] = {
        ...baseRecord,
        ...next[foundIndex],
        note: enquiry.note,
        imageUrl: enquiry.imageUrl ?? next[foundIndex].imageUrl,
        priority: next[foundIndex].priority ?? priority,
      };
      return;
    }

    next.unshift(baseRecord);
  });

  writeCases(next);
  return next;
}

export function syncRegionalCaseSeeds(records: AgronomistCaseRecord[]) {
  const existing = readCases();
  const next = [...existing];

  records.forEach((record) => {
    const foundIndex = next.findIndex((entry) => entry.id === record.id);
    if (foundIndex >= 0) {
      next[foundIndex] = {
        ...record,
        ...next[foundIndex],
        note: record.note,
        imageUrl: record.imageUrl ?? next[foundIndex].imageUrl,
      };
      return;
    }

    next.unshift({
      ...record,
      caseStatus: record.caseStatus ?? 'new',
      priority: record.priority ?? 'normal',
      updatedAt: record.updatedAt ?? record.createdAt,
    });
  });

  writeCases(next);
  return next;
}

export function getFarmerCases(farmerId: string) {
  return readCases()
    .filter((record) => record.farmerId === farmerId)
    .sort((left, right) => (right.updatedAt ?? right.createdAt).localeCompare(left.updatedAt ?? left.createdAt));
}

export function getRegionalCases(regionId: string) {
  return readCases()
    .filter((record) => record.regionId === regionId)
    .sort((left, right) => (right.updatedAt ?? right.createdAt).localeCompare(left.updatedAt ?? left.createdAt));
}

export function updateAgronomistCase(input: {
  caseId: string;
  agronomist: UserProfile;
  caseStatus: NonNullable<AgronomistCaseRecord['caseStatus']>;
  diagnosisSummary: string;
  responseNote: string;
  recommendedProduct: string;
}) {
  const next = readCases().map((record) =>
    record.id === input.caseId
      ? {
          ...record,
          caseStatus: input.caseStatus,
          assignedAgronomistId: input.agronomist.id,
          assignedAgronomistName: input.agronomist.fullName,
          diagnosisSummary: input.diagnosisSummary.trim(),
          responseNote: input.responseNote.trim(),
          recommendedProduct: input.recommendedProduct.trim(),
          updatedAt: nowIso(),
          lastResponseAt: nowIso(),
        }
      : record,
  );

  writeCases(next);
  const saved = next.find((record) => record.id === input.caseId) ?? null;
  if (saved) {
    void syncAgronomistCaseToGateway({
      actor: input.agronomist,
      profile: input.agronomist,
      caseRecord: saved,
      action: 'case-updated',
    }).catch(() => null);
  }
  return saved;
}

export function buildMarketplaceOrder(input: {
  farmer: UserProfile;
  cropId: MarketplaceOrderRecord['cropId'];
  totalAreaHa: number;
  budget: BudgetSummary;
  notes: string;
}) {
  const lines: MarketplaceOrderLine[] = [];

  if (input.budget.seedSummary) {
    lines.push({
      id: `${input.budget.cropId}-seed`,
      category: 'seed',
      supplierName: input.budget.seedSummary.source.vendor,
      productName: input.budget.seedSummary.productName,
      quantityLabel: `${input.budget.seedSummary.packsNeeded} x ${input.budget.seedSummary.packLabel}`,
      unitPriceUsd: input.budget.seedSummary.packPriceUsd,
      lineTotalUsd: Number(input.budget.seedSummary.estimatedCostUsd.toFixed(2)),
      url: input.budget.seedSummary.source.url,
    });
  }

  input.budget.stageLines.forEach((line) => {
    lines.push({
      id: line.id,
      category:
        line.kind === 'fertiliser'
          ? 'fertiliser'
          : line.kind === 'herbicide'
            ? 'herbicide'
            : line.kind === 'pesticide' || line.kind === 'fungicide'
              ? 'pesticide'
              : 'services',
      supplierName: line.source.vendor,
      productName: line.productName,
      quantityLabel: `${line.packsNeeded} x ${line.packLabel}`,
      unitPriceUsd: line.packPriceUsd,
      lineTotalUsd: Number(line.stageCostUsd.toFixed(2)),
      url: line.source.url,
    });
  });

  const totalCostUsd = Number(lines.reduce((sum, line) => sum + line.lineTotalUsd, 0).toFixed(2));
  const order: MarketplaceOrderRecord = {
    id: makeId(),
    farmerId: input.farmer.id,
    cropId: input.cropId,
    totalAreaHa: input.totalAreaHa,
    status: 'submitted',
    supplierCount: new Set(lines.map((line) => line.supplierName)).size,
    totalCostUsd,
    notes: input.notes.trim(),
    lines,
    requestedAt: nowIso(),
    updatedAt: nowIso(),
  };

  writeOrders([order, ...readOrders()]);
  return order;
}

export function getFarmerOrders(farmerId: string) {
  return readOrders()
    .filter((record) => record.farmerId === farmerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createPaymentRecord(input: {
  farmerId: string;
  orderId: string;
  amountUsd: number;
  method: PaymentMethod;
  reference?: string;
}) {
  const gateway = await createGatewayPaymentSession(input).catch(() => null);
  const payment: PaymentRecord = {
    id: makeId(),
    farmerId: input.farmerId,
    orderId: input.orderId,
    amountUsd: Number(input.amountUsd.toFixed(2)),
    method: input.method,
    status: gateway?.status ?? 'pending',
    provider: gateway?.provider,
    reference: gateway?.reference?.trim() || input.reference?.trim() || undefined,
    checkoutUrl: gateway?.checkoutUrl,
    statusNote: gateway?.note,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  writePayments([payment, ...readPayments()]);

  const nextOrders = readOrders().map((order) =>
    order.id === input.orderId
      ? {
          ...order,
          status: payment.status === 'paid' ? ('paid' as const) : ('quoted' as const),
          updatedAt: nowIso(),
        }
      : order,
  );
  writeOrders(nextOrders);

  return payment;
}

export function getFarmerPayments(farmerId: string) {
  return readPayments()
    .filter((record) => record.farmerId === farmerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function saveHarvestRecord(input: Omit<HarvestRecord, 'id' | 'createdAt'>) {
  const record: HarvestRecord = {
    ...input,
    id: makeId(),
    createdAt: nowIso(),
  };

  writeHarvests([record, ...readHarvests()]);
  return record;
}

export function getFarmerHarvests(farmerId: string) {
  return readHarvests()
    .filter((record) => record.farmerId === farmerId)
    .sort((left, right) => right.harvestDate.localeCompare(left.harvestDate));
}

export function getYieldSummary(farmerId: string, cropId: HarvestRecord['cropId']) {
  const harvests = getFarmerHarvests(farmerId).filter((record) => record.cropId === cropId);
  const totalHarvestedAreaHa = harvests.reduce((sum, record) => sum + record.harvestedAreaHa, 0);
  const totalYieldAmount = harvests.reduce((sum, record) => sum + record.yieldAmount, 0);

  return {
    records: harvests,
    totalHarvestedAreaHa,
    totalYieldAmount,
    averageYieldPerHa:
      totalHarvestedAreaHa > 0 ? Number((totalYieldAmount / totalHarvestedAreaHa).toFixed(2)) : 0,
  };
}

export function getBoardIntegrations(boardId?: BoardIntegrationRecord['boardId']) {
  return readIntegrations()
    .filter((record) => !boardId || !record.boardId || record.boardId === boardId)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function updateBoardIntegration(input: {
  id: string;
  status: BoardIntegrationRecord['status'];
  summary: string;
}) {
  const next = readIntegrations().map((record) =>
    record.id === input.id
      ? {
          ...record,
          status: input.status,
          summary: input.summary.trim(),
          lastSyncAt: nowIso(),
        }
      : record,
  );

  writeIntegrations(next);
  return next.find((record) => record.id === input.id) ?? null;
}

export function getMobileReleaseChecklist() {
  return readMobileChecklist();
}

export function updateMobileReleaseItem(input: {
  id: string;
  status: MobileReleaseItem['status'];
}) {
  const next = readMobileChecklist().map((item) =>
    item.id === input.id
      ? {
          ...item,
          status: input.status,
        }
      : item,
  );

  writeMobileChecklist(next);
  return next;
}

export function getOperationsSnapshot() {
  const orders = readOrders();
  const payments = readPayments();
  const harvests = readHarvests();
  const cases = readCases();

  return {
    orders,
    payments,
    harvests,
    cases,
    integrations: readIntegrations(),
    mobileRelease: readMobileChecklist(),
  };
}
