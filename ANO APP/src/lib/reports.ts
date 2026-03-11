import type {
  AgronomistCaseRecord,
  FarmerCropPlan,
  HarvestRecord,
  MarketplaceOrderRecord,
  PaymentRecord,
  PlantingProgressEntry,
  UserProfile,
} from './app-types';

function escapeCsv(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadText(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const content = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
    .join('\n');
  downloadText(filename, content, 'text/csv;charset=utf-8');
}

export function downloadJson(filename: string, payload: unknown) {
  downloadText(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function exportFarmerPerformanceReport(input: {
  profile: UserProfile;
  plans: FarmerCropPlan[];
  plantingEntries: PlantingProgressEntry[];
  orders: MarketplaceOrderRecord[];
  payments: PaymentRecord[];
  harvests: HarvestRecord[];
  cases: AgronomistCaseRecord[];
}) {
  const rows = [
    ...input.plans.map((plan) => [
      'plan',
      plan.cropId,
      plan.totalAreaHa,
      plan.plantingDate,
      plan.boardStatus,
      plan.growerId ?? '',
      '',
    ]),
    ...input.plantingEntries.map((entry) => [
      'planting',
      entry.cropId,
      entry.areaHa,
      entry.entryDate,
      entry.syncState,
      '',
      '',
    ]),
    ...input.orders.map((order) => [
      'order',
      order.cropId,
      order.totalAreaHa,
      order.requestedAt.slice(0, 10),
      order.status,
      order.totalCostUsd,
      order.supplierCount,
    ]),
    ...input.payments.map((payment) => [
      'payment',
      '',
      payment.amountUsd,
      payment.createdAt.slice(0, 10),
      payment.status,
      payment.method,
      payment.reference ?? '',
    ]),
    ...input.harvests.map((harvest) => [
      'harvest',
      harvest.cropId,
      harvest.yieldAmount,
      harvest.harvestDate,
      harvest.grade,
      harvest.harvestedAreaHa,
      harvest.yieldUnit,
    ]),
    ...input.cases.map((record) => [
      'case',
      record.cropId,
      '',
      record.createdAt.slice(0, 10),
      record.caseStatus ?? 'new',
      record.assignedAgronomistName ?? '',
      record.recommendedProduct ?? '',
    ]),
  ];

  downloadCsv(
    `${input.profile.fullName.replace(/\s+/g, '-').toLowerCase()}-season-report.csv`,
    ['section', 'crop', 'value', 'date', 'status', 'detail', 'extra'],
    rows,
  );
}
