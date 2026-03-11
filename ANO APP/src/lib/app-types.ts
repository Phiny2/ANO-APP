import type { BoardId, Country, CropId } from '../data';

export type AppRole = 'farmer' | 'board' | 'agronomist' | 'staff' | 'admin';
export type BoardStatus = 'not-linked' | 'linked' | 'verified';
export type SyncState = 'synced' | 'pending';
export type DeliveryStatus = 'not-booked' | 'booked' | 'delivered' | 'cleared';
export type PaymentStatus = 'not-raised' | 'awaiting-board' | 'approved' | 'paid';
export type AgronomistAvailability = 'available' | 'busy' | 'field-visit';
export type FarmTeamRole = 'manager' | 'scout' | 'worker';
export type SoilType = 'sandy' | 'loam' | 'clay';
export type IrrigationMethod = 'drip' | 'sprinkler' | 'pivot' | 'furrow' | 'rainfed';
export type CaseStatus = 'new' | 'triaged' | 'in-progress' | 'resolved';
export type MarketplaceCategory = 'seed' | 'fertiliser' | 'herbicide' | 'pesticide' | 'services';
export type MarketplaceOrderStatus = 'draft' | 'submitted' | 'quoted' | 'paid' | 'fulfilled';
export type PaymentMethod = 'EcoCash' | 'Bank transfer' | 'Card' | 'Cash on delivery';
export type PaymentRecordStatus = 'initiated' | 'pending' | 'paid';
export type BoardIntegrationStatus = 'connected' | 'warning' | 'planned' | 'offline';
export type BoardIntegrationMode = 'live' | 'hybrid' | 'demo';
export type MobileReleaseStatus = 'ready' | 'in-progress' | 'pending';

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  farmName?: string;
  country: Country;
  regionId: string;
  boardId?: BoardId;
  soilType?: SoilType;
  irrigationMethod?: IrrigationMethod;
  locationDetail?: string;
  whatsappNumber?: string;
  specializationIds?: string[];
  availabilityStatus?: AgronomistAvailability;
  createdAt: string;
  updatedAt: string;
}

export interface FarmTeamInviteRecord {
  id: string;
  farmerId: string;
  inviteCode: string;
  label: string;
  teamRole: FarmTeamRole;
  createdAt: string;
  claimedAt?: string;
  isActive: boolean;
}

export interface FarmTeamMemberRecord {
  id: string;
  farmerId: string;
  staffUserId: string;
  fullName: string;
  email: string;
  teamRole: FarmTeamRole;
  status: 'active';
  createdAt: string;
}

export interface FarmerCropPlan {
  id: string;
  farmerId: string;
  cropId: CropId;
  boardId: BoardId;
  varietyName?: string;
  plantingDate: string;
  totalAreaHa: number;
  growerId?: string;
  boardStatus: BoardStatus;
  verificationSource?: string;
  createdAt: string;
  updatedAt: string;
  syncState?: SyncState;
}

export interface PlantingProgressEntry {
  id: string;
  planId: string;
  farmerId: string;
  cropId: CropId;
  entryDate: string;
  areaHa: number;
  createdAt: string;
  syncState: SyncState;
}

export interface CropEnquiryRecord {
  id: string;
  farmerId: string;
  cropId: CropId;
  boardId: BoardId;
  issueId: string;
  note: string;
  imagePath?: string;
  imageUrl?: string;
  createdAt: string;
  syncState: SyncState;
}

export interface BoardTransactionRecord {
  id: string;
  farmerId: string;
  cropId: CropId;
  boardId: BoardId;
  deliveryPoint: string;
  targetDeliveryDate: string;
  estimatedVolume: number;
  actualDeliveredVolume?: number;
  estimatedGrossUsd?: number;
  estimatedNetUsd?: number;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  paymentDueDate?: string;
  paymentReference?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  syncState: SyncState;
}

export interface BoardGrowerSummary {
  farmerId: string;
  fullName: string;
  email: string;
  regionId: string;
  cropId: CropId;
  plantingDate: string;
  totalAreaHa: number;
  boardStatus: BoardStatus;
  growerId?: string;
}

export interface AgronomistDirectoryRecord {
  id: string;
  fullName: string;
  email: string;
  country: Country;
  regionId: string;
  locationDetail?: string;
  whatsappNumber?: string;
  specializationIds: string[];
  availabilityStatus: AgronomistAvailability;
}

export interface AgronomistFarmerSummary {
  farmerId: string;
  fullName: string;
  email: string;
  regionId: string;
  cropId: CropId;
  plantingDate: string;
  totalAreaHa: number;
  boardStatus: BoardStatus;
}

export interface AgronomistCaseRecord {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerEmail: string;
  regionId: string;
  cropId: CropId;
  boardId: BoardId;
  issueId: string;
  note: string;
  imageUrl?: string;
  createdAt: string;
  caseStatus?: CaseStatus;
  assignedAgronomistId?: string;
  assignedAgronomistName?: string;
  diagnosisSummary?: string;
  responseNote?: string;
  recommendedProduct?: string;
  priority?: 'normal' | 'urgent';
  updatedAt?: string;
  lastResponseAt?: string;
}

export interface SupplierOfferRecord {
  id: string;
  cropId: CropId;
  category: MarketplaceCategory;
  supplierName: string;
  productName: string;
  unitLabel: string;
  unitPriceUsd: number;
  stockStatus: 'in-stock' | 'limited' | 'quote';
  note: string;
  url: string;
  regionIds?: string[];
}

export interface MarketplaceOrderLine {
  id: string;
  category: MarketplaceCategory;
  supplierName: string;
  productName: string;
  quantityLabel: string;
  unitPriceUsd: number;
  lineTotalUsd: number;
  url?: string;
}

export interface MarketplaceOrderRecord {
  id: string;
  farmerId: string;
  cropId: CropId;
  totalAreaHa: number;
  status: MarketplaceOrderStatus;
  supplierCount: number;
  totalCostUsd: number;
  notes: string;
  lines: MarketplaceOrderLine[];
  requestedAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  farmerId: string;
  orderId: string;
  amountUsd: number;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  provider?: string;
  reference?: string;
  checkoutUrl?: string;
  statusNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HarvestRecord {
  id: string;
  farmerId: string;
  cropId: CropId;
  harvestDate: string;
  harvestedAreaHa: number;
  yieldAmount: number;
  yieldUnit: 't' | 'kg' | 'bales';
  grade: string;
  moisturePct?: number;
  lossesPct?: number;
  notes: string;
  createdAt: string;
}

export interface BoardIntegrationRecord {
  id: string;
  label: string;
  boardId?: BoardId;
  status: BoardIntegrationStatus;
  mode?: BoardIntegrationMode;
  configured?: boolean;
  provider?: string;
  summary: string;
  endpoint?: string;
  requirements?: string[];
  lastSyncAt?: string;
}

export interface MobileReleaseItem {
  id: string;
  title: string;
  detail: string;
  status: MobileReleaseStatus;
}

export interface FarmerWorkspace {
  profile: UserProfile;
  plans: FarmerCropPlan[];
  plantingEntries: PlantingProgressEntry[];
  transactions: BoardTransactionRecord[];
  enquiries: CropEnquiryRecord[];
  agronomists: AgronomistDirectoryRecord[];
  teamInvites: FarmTeamInviteRecord[];
  teamMembers: FarmTeamMemberRecord[];
  pendingSyncCount: number;
}

export interface BoardWorkspace {
  profile: UserProfile;
  growers: BoardGrowerSummary[];
  transactions: BoardTransactionRecord[];
  enquiries: CropEnquiryRecord[];
}

export interface AgronomistWorkspace {
  profile: UserProfile;
  regionalFarmers: AgronomistFarmerSummary[];
  regionalCases: AgronomistCaseRecord[];
}

export interface StaffWorkspace {
  profile: UserProfile;
  farmer: UserProfile;
  membership: FarmTeamMemberRecord;
  plans: FarmerCropPlan[];
  plantingEntries: PlantingProgressEntry[];
  transactions: BoardTransactionRecord[];
  enquiries: CropEnquiryRecord[];
  pendingSyncCount: number;
}

export interface SignUpFarmerInput {
  email: string;
  password: string;
  fullName: string;
  farmName: string;
  country: Country;
  regionId: string;
}

export interface SignUpAgronomistInput {
  email: string;
  password: string;
  fullName: string;
  country: Country;
  regionId: string;
  locationDetail: string;
  whatsappNumber: string;
  specializationIds: string[];
  availabilityStatus: AgronomistAvailability;
}

export interface SignUpStaffInput {
  email: string;
  password: string;
  fullName: string;
  inviteCode: string;
}

export interface SignInInput {
  login: string;
  password: string;
}

export interface FarmTeamInviteInput {
  label: string;
  teamRole: FarmTeamRole;
}

export interface CropPlanInput {
  cropId: CropId;
  varietyName?: string;
  plantingDate: string;
  totalAreaHa: number;
}

export interface BoardLinkInput {
  cropId: CropId;
  growerId: string;
  pin: string;
}

export interface PlantingProgressInput {
  cropId: CropId;
  entryDate: string;
  areaHa: number;
}

export interface BoardTransactionInput {
  cropId: CropId;
  deliveryPoint: string;
  targetDeliveryDate: string;
  estimatedVolume: number;
  estimatedGrossUsd?: number;
  estimatedNetUsd?: number;
  notes: string;
}

export interface BoardTransactionUpdateInput {
  transactionId: string;
  actualDeliveredVolume?: number;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  paymentDueDate?: string;
  paymentReference?: string;
  notes: string;
}

export interface CropEnquiryInput {
  cropId: CropId;
  issueId: string;
  note: string;
  imageFile?: File | null;
}

export interface BackendStatus {
  configured: boolean;
  mode: 'online' | 'demo';
  detail: string;
}

export interface AuthState {
  profile: UserProfile | null;
  backend: BackendStatus;
}

export interface PendingMutation {
  id: string;
  type:
    | 'profile-update'
    | 'plan-upsert'
    | 'plan-link'
    | 'planting-record'
    | 'transaction-upsert'
    | 'transaction-update'
    | 'enquiry-submit'
    | 'team-invite-create';
  userId: string;
  payload: unknown;
  createdAt: string;
}
