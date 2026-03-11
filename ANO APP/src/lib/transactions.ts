import { boards, crops, regions, type BoardId, type CropId } from '../data';
import type {
  BoardStatus,
  BoardTransactionInput,
  BoardTransactionRecord,
  DeliveryStatus,
  PaymentStatus,
} from './app-types';

export interface DeliveryPointOption {
  boardId: BoardId;
  regionIds?: string[];
  name: string;
}

export interface DeliveryChecklistItem {
  title: string;
  detail: string;
}

export interface TransactionProjection {
  volumeUnit: 'mt' | 'kg' | 'tonnes cane';
  suggestedVolume: number;
  suggestedGrossUsd?: number;
  suggestedNetUsd?: number;
}

const deliveryPoints: DeliveryPointOption[] = [
  { boardId: 'gmb', name: 'Lions Den GMB depot', regionIds: ['mash-west'] },
  { boardId: 'gmb', name: 'Karoi GMB depot', regionIds: ['mash-west'] },
  { boardId: 'gmb', name: 'Bindura GMB depot', regionIds: ['mash-central'] },
  { boardId: 'gmb', name: 'Marondera GMB depot', regionIds: ['mash-east'] },
  { boardId: 'gmb', name: 'Gweru GMB depot', regionIds: ['midlands'] },
  { boardId: 'gmb', name: 'Mutare GMB depot', regionIds: ['manicaland'] },
  { boardId: 'gmb', name: 'Mvurwi GMB depot' },
  { boardId: 'timb', name: 'Auction Floors Harare', regionIds: ['mash-west', 'mash-central', 'mash-east'] },
  { boardId: 'timb', name: 'Mvurwi satellite floor', regionIds: ['mash-west', 'mash-central'] },
  { boardId: 'timb', name: 'Rusape satellite floor', regionIds: ['mash-east', 'manicaland'] },
  { boardId: 'sugar-hub', name: 'Triangle cane intake', regionIds: ['masvingo-lowveld'] },
  { boardId: 'sugar-hub', name: 'Hippo Valley cane intake', regionIds: ['masvingo-lowveld'] },
  { boardId: 'sugar-hub', name: 'Simunye cane intake', regionIds: ['eswatini-lowveld'] },
];

const cropUnits: Record<CropId, TransactionProjection['volumeUnit']> = {
  maize: 'mt',
  wheat: 'mt',
  soyabean: 'mt',
  tobacco: 'kg',
  sugarcane: 'tonnes cane',
};

const checklists: Record<CropId, DeliveryChecklistItem[]> = {
  maize: [
    { title: 'Producer record', detail: 'Carry the verified grower or producer reference before delivery.' },
    { title: 'Moisture readiness', detail: 'Dry grain to the board or buyer moisture requirement before transport.' },
    { title: 'Haulage plan', detail: 'Confirm depot space, bags, and truck timing before dispatch.' },
  ],
  wheat: [
    { title: 'Grade and protein', detail: 'Separate premium and standard wheat if quality differs across fields.' },
    { title: 'Moisture check', detail: 'Avoid storage and delivery losses by checking moisture before booking trucks.' },
    { title: 'Board intake slot', detail: 'Book or confirm the delivery window before harvest pressure peaks.' },
  ],
  soyabean: [
    { title: 'Dry and clean grain', detail: 'Keep foreign matter low so the soy delivery is not downgraded.' },
    { title: 'Producer reference', detail: 'Use the same grower and board details linked in the app.' },
    { title: 'Storage and transport', detail: 'Protect bags from moisture while waiting for transport.' },
  ],
  tobacco: [
    { title: 'Booking reference', detail: 'Keep the floor or booking reference ready before sending bales.' },
    { title: 'Bale preparation', detail: 'Grade, weigh, and label tobacco bales according to board rules.' },
    { title: 'Loan and stop-order check', detail: 'Review expected deductions before the first sale day.' },
  ],
  sugarcane: [
    { title: 'Contract statement', detail: 'Confirm the cane contract, intake window, and transport route first.' },
    { title: 'Cut-to-crush timing', detail: 'Plan cutting and haulage tightly so cane does not lose value before crushing.' },
    { title: 'Weighbridge record', detail: 'Capture weighbridge and field reference details for payment reconciliation.' },
  ],
};

function addDays(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

export function getDeliveryPointOptions(cropId: CropId, regionId: string) {
  const boardId = crops.find((crop) => crop.id === cropId)?.boardId;
  return deliveryPoints.filter(
    (option) => option.boardId === boardId && (!option.regionIds || option.regionIds.includes(regionId)),
  );
}

export function getDeliveryChecklist(cropId: CropId) {
  return checklists[cropId] ?? [];
}

export function getVolumeUnit(cropId: CropId) {
  return cropUnits[cropId];
}

export function buildSuggestedTransactionProjection(input: {
  cropId: CropId;
  totalAreaHa: number;
  targetYieldPerHa: number;
  targetGrossUsd?: number | null;
  targetNetUsd?: number | null;
}) {
  const suggestedVolume = Number((input.totalAreaHa * input.targetYieldPerHa).toFixed(cropUnits[input.cropId] === 'kg' ? 0 : 2));
  return {
    volumeUnit: cropUnits[input.cropId],
    suggestedVolume,
    suggestedGrossUsd: input.targetGrossUsd === null ? undefined : input.targetGrossUsd,
    suggestedNetUsd: input.targetNetUsd === null ? undefined : input.targetNetUsd,
  } satisfies TransactionProjection;
}

export function buildTransactionDraft(input: {
  id: string;
  farmerId: string;
  cropId: CropId;
  boardId: BoardId;
  boardStatus: BoardStatus;
  transaction: BoardTransactionInput;
  estimatedGrossUsd?: number;
  estimatedNetUsd?: number;
  previousTransaction?: Pick<
    BoardTransactionRecord,
    | 'actualDeliveredVolume'
    | 'createdAt'
    | 'deliveryStatus'
    | 'estimatedGrossUsd'
    | 'estimatedNetUsd'
    | 'paymentDueDate'
    | 'paymentReference'
    | 'paymentStatus'
  > | null;
  syncState: BoardTransactionRecord['syncState'];
  createdAt: string;
}) {
  const deliveryStatus: DeliveryStatus =
    input.previousTransaction?.deliveryStatus ??
    (input.boardStatus === 'verified' ? 'booked' : 'not-booked');
  const paymentStatus: PaymentStatus =
    input.previousTransaction?.paymentStatus ??
    (input.boardStatus === 'verified' ? 'awaiting-board' : 'not-raised');

  return {
    id: input.id,
    farmerId: input.farmerId,
    cropId: input.cropId,
    boardId: input.boardId,
    deliveryPoint: input.transaction.deliveryPoint,
    targetDeliveryDate: input.transaction.targetDeliveryDate,
    estimatedVolume: input.transaction.estimatedVolume,
    actualDeliveredVolume: input.previousTransaction?.actualDeliveredVolume,
    estimatedGrossUsd:
      input.transaction.estimatedGrossUsd ??
      input.previousTransaction?.estimatedGrossUsd ??
      input.estimatedGrossUsd,
    estimatedNetUsd:
      input.transaction.estimatedNetUsd ??
      input.previousTransaction?.estimatedNetUsd ??
      input.estimatedNetUsd,
    deliveryStatus,
    paymentStatus,
    paymentDueDate:
      input.previousTransaction?.paymentDueDate ??
      (input.boardStatus === 'verified'
        ? addDays(input.transaction.targetDeliveryDate, input.cropId === 'tobacco' ? 5 : 14)
        : undefined),
    paymentReference:
      input.previousTransaction?.paymentReference ??
      (input.boardStatus === 'verified' ? `${input.boardId.toUpperCase()}-${input.id.slice(0, 8)}` : undefined),
    notes: input.transaction.notes.trim(),
    createdAt: input.previousTransaction?.createdAt ?? input.createdAt,
    updatedAt: input.createdAt,
    syncState: input.syncState,
  } satisfies BoardTransactionRecord;
}

export function getDeliveryStatusTone(status: DeliveryStatus) {
  if (status === 'cleared') {
    return 'success';
  }

  if (status === 'delivered' || status === 'booked') {
    return 'warning';
  }

  return 'neutral';
}

export function getPaymentStatusTone(status: PaymentStatus) {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'approved' || status === 'awaiting-board') {
    return 'warning';
  }

  return 'neutral';
}

export function describeTransactionStatus(transaction: BoardTransactionRecord) {
  if (transaction.paymentStatus === 'paid') {
    return 'Payment has been recorded for this delivery.';
  }

  if (transaction.paymentStatus === 'approved') {
    return `Payment reference ${transaction.paymentReference ?? 'ready'} is approved and should clear soon.`;
  }

  if (transaction.deliveryStatus === 'delivered') {
    return 'The delivery is on record and the board is processing settlement.';
  }

  if (transaction.deliveryStatus === 'booked') {
    return 'The delivery slot is booked. Keep documents and transport aligned with the target date.';
  }

  return 'Link and verify the board record first so the booking can move into the delivery pipeline.';
}

export function getBoardLabel(boardId: BoardId) {
  return boards.find((board) => board.id === boardId)?.name ?? boardId;
}

export function getRegionLabel(regionId: string) {
  return regions.find((region) => region.id === regionId)?.name ?? regionId;
}
