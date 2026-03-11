import {
  agronomistUsers,
  boardUsers,
  crops,
  growerRegistry,
  regions,
  type BoardId,
  type Country,
  type CropId,
} from '../data';
import { demoAdminUsers } from './platform-catalog';
import {
  cacheGet,
  cacheSet,
  clearPendingMutation,
  getPendingMutations,
  pushPendingMutation,
  replacePendingMutations,
} from './cache';
import type {
  AgronomistCaseRecord,
  AgronomistDirectoryRecord,
  AgronomistFarmerSummary,
  AgronomistWorkspace,
  AuthState,
  BackendStatus,
  BoardGrowerSummary,
  BoardLinkInput,
  BoardStatus,
  FarmTeamInviteInput,
  FarmTeamInviteRecord,
  FarmTeamMemberRecord,
  FarmTeamRole,
  StaffWorkspace,
  BoardTransactionUpdateInput,
  BoardWorkspace,
  BoardTransactionInput,
  BoardTransactionRecord,
  CropEnquiryInput,
  CropEnquiryRecord,
  CropPlanInput,
  FarmerCropPlan,
  FarmerWorkspace,
  PlantingProgressEntry,
  PlantingProgressInput,
  PendingMutation,
  SignUpAgronomistInput,
  SignUpStaffInput,
  SignInInput,
  SignUpFarmerInput,
  SyncState,
  UserProfile,
} from './app-types';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOutUser,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  firebaseAuth,
  firebaseConfigured,
  firebaseDb,
  firebaseStorage,
} from './firebase';
import {
  syncAgronomistCaseToGateway,
  syncBoardTransactionToGateway,
} from './integrations';
import { buildTransactionDraft } from './transactions';

interface DemoCredential extends UserProfile {
  password: string;
  login: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  role: 'farmer' | 'board' | 'agronomist' | 'staff' | 'admin';
  full_name: string;
  farm_name?: string | null;
  country: Country;
  region_id: string;
  board_id: BoardId | null;
  soil_type?: 'sandy' | 'loam' | 'clay' | null;
  irrigation_method?: 'drip' | 'sprinkler' | 'pivot' | 'furrow' | 'rainfed' | null;
  location_detail: string | null;
  whatsapp_number: string | null;
  specialization_ids: string[] | null;
  availability_status: 'available' | 'busy' | 'field-visit' | null;
  created_at: string;
  updated_at: string;
}

interface TeamInviteRow {
  id: string;
  farmer_id: string;
  invite_code: string;
  label: string;
  team_role: FarmTeamRole;
  created_at: string;
  claimed_at: string | null;
  is_active: boolean;
}

interface TeamMemberRow {
  id: string;
  farmer_id: string;
  staff_id: string;
  team_role: FarmTeamRole;
  invite_code?: string | null;
  status: 'active';
  created_at: string;
}

interface PlanRow {
  id: string;
  farmer_id: string;
  crop_id: CropId;
  board_id: BoardId;
  variety_name?: string | null;
  planting_date: string;
  total_area_ha: number | string | null;
  grower_id: string | null;
  board_status: BoardStatus;
  verification_source: string | null;
  created_at: string;
  updated_at: string;
}

interface PlantingRow {
  id: string;
  plan_id: string;
  farmer_id: string;
  crop_id: CropId;
  entry_date: string;
  area_ha: number | string;
  created_at: string;
}

interface TransactionRow {
  id: string;
  farmer_id: string;
  crop_id: CropId;
  board_id: BoardId;
  delivery_point: string;
  target_delivery_date: string;
  estimated_volume: number | string;
  actual_delivered_volume: number | string | null;
  estimated_gross_usd: number | string | null;
  estimated_net_usd: number | string | null;
  delivery_status: 'not-booked' | 'booked' | 'delivered' | 'cleared';
  payment_status: 'not-raised' | 'awaiting-board' | 'approved' | 'paid';
  payment_due_date: string | null;
  payment_reference: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface EnquiryRow {
  id: string;
  farmer_id: string;
  crop_id: CropId;
  board_id: BoardId;
  issue_id: string;
  note: string;
  image_path: string | null;
  created_at: string;
}

const demoUsersKey = 'ano-demo-users';
const demoSessionKey = 'ano-demo-session';
const demoPlansKey = 'ano-demo-plans';
const demoPlantingEntriesKey = 'ano-demo-planting-entries';
const demoTransactionsKey = 'ano-demo-transactions';
const demoEnquiriesKey = 'ano-demo-enquiries';
const demoTeamInvitesKey = 'ano-demo-team-invites';
const demoTeamMembersKey = 'ano-demo-team-members';
const cropEnquiryBucket = 'crop-enquiries';
const userProfilesCollection = 'user_profiles';
const farmerPlansCollection = 'farmer_crop_plans';
const plantingEntriesCollection = 'planting_progress_entries';
const transactionsCollection = 'board_transactions';
const enquiriesCollection = 'crop_enquiries';
const teamInvitesCollection = 'farm_team_invites';
const teamMembersCollection = 'farm_team_members';

function makeId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function makeInviteCode() {
  return `ANO-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function omitId<T extends { id: string }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = value;
  return rest;
}

async function waitForFirebaseUser() {
  if (!firebaseAuth) {
    return null;
  }
  const auth = firebaseAuth;

  return new Promise<FirebaseUser | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function readCollectionRows<T extends { id: string }>(
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  if (!firebaseDb) {
    return [] as T[];
  }

  const snapshot = await getDocs(query(collection(firebaseDb, collectionName), ...constraints));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as T);
}

async function readCollectionRow<T extends { id: string }>(
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  const rows = await readCollectionRows<T>(collectionName, ...constraints, limit(1));
  return rows[0] ?? null;
}

async function readDocumentRow<T extends { id: string }>(collectionName: string, id: string) {
  if (!firebaseDb) {
    return null;
  }

  const snapshot = await getDoc(doc(firebaseDb, collectionName, id));
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T;
}

async function writeDocumentRow<T extends { id: string }>(
  collectionName: string,
  value: T,
  merge: boolean = true,
) {
  if (!firebaseDb) {
    throw new Error('Firebase is not configured.');
  }

  await setDoc(doc(firebaseDb, collectionName, value.id), omitId(value), { merge });
}

function backendStatus(): BackendStatus {
  if (firebaseConfigured) {
    return {
      configured: true,
      mode: 'online',
      detail: 'Firebase is configured, so data can sync across users, boards, and devices.',
    };
  }

  return {
    configured: false,
    mode: 'demo',
    detail: 'Firebase is not configured yet, so the app is using local demo data and browser storage.',
  };
}

function cropBoardId(cropId: CropId): BoardId {
  return crops.find((crop) => crop.id === cropId)?.boardId ?? 'gmb';
}

function farmerWorkspaceCacheKey(userId: string) {
  return `ano-cache-farmer:${userId}`;
}

function boardWorkspaceCacheKey(userId: string) {
  return `ano-cache-board:${userId}`;
}

function agronomistWorkspaceCacheKey(userId: string) {
  return `ano-cache-agronomist:${userId}`;
}

function staffWorkspaceCacheKey(userId: string) {
  return `ano-cache-staff:${userId}`;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email ?? '',
    role: row.role,
    fullName: row.full_name,
    farmName: row.farm_name ?? undefined,
    country: row.country,
    regionId: row.region_id,
    boardId: row.board_id ?? undefined,
    soilType: row.soil_type ?? undefined,
    irrigationMethod: row.irrigation_method ?? undefined,
    locationDetail: row.location_detail ?? undefined,
    whatsappNumber: row.whatsapp_number ?? undefined,
    specializationIds: row.specialization_ids ?? [],
    availabilityStatus: row.availability_status ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlanRow(row: PlanRow, syncState: SyncState = 'synced'): FarmerCropPlan {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    cropId: row.crop_id,
    boardId: row.board_id,
    varietyName: row.variety_name ?? undefined,
    plantingDate: row.planting_date,
    totalAreaHa: Number(row.total_area_ha ?? 0),
    growerId: row.grower_id ?? undefined,
    boardStatus: row.board_status,
    verificationSource: row.verification_source ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState,
  };
}

function mapPlantingRow(row: PlantingRow, syncState: SyncState = 'synced'): PlantingProgressEntry {
  return {
    id: row.id,
    planId: row.plan_id,
    farmerId: row.farmer_id,
    cropId: row.crop_id,
    entryDate: row.entry_date,
    areaHa: Number(row.area_ha),
    createdAt: row.created_at,
    syncState,
  };
}

function mapTransactionRow(row: TransactionRow, syncState: SyncState = 'synced'): BoardTransactionRecord {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    cropId: row.crop_id,
    boardId: row.board_id,
    deliveryPoint: row.delivery_point,
    targetDeliveryDate: row.target_delivery_date,
    estimatedVolume: Number(row.estimated_volume),
    actualDeliveredVolume: row.actual_delivered_volume === null ? undefined : Number(row.actual_delivered_volume),
    estimatedGrossUsd: row.estimated_gross_usd === null ? undefined : Number(row.estimated_gross_usd),
    estimatedNetUsd: row.estimated_net_usd === null ? undefined : Number(row.estimated_net_usd),
    deliveryStatus: row.delivery_status,
    paymentStatus: row.payment_status,
    paymentDueDate: row.payment_due_date ?? undefined,
    paymentReference: row.payment_reference ?? undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState,
  };
}

function mapEnquiryRow(row: EnquiryRow, imageUrl?: string, syncState: SyncState = 'synced'): CropEnquiryRecord {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    cropId: row.crop_id,
    boardId: row.board_id,
    issueId: row.issue_id,
    note: row.note,
    imagePath: row.image_path ?? undefined,
    imageUrl,
    createdAt: row.created_at,
    syncState,
  };
}

function mapAgronomistDirectoryEntry(profile: UserProfile): AgronomistDirectoryRecord {
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    country: profile.country,
    regionId: profile.regionId,
    locationDetail: profile.locationDetail,
    whatsappNumber: profile.whatsappNumber,
    specializationIds: profile.specializationIds ?? [],
    availabilityStatus: profile.availabilityStatus ?? 'available',
  };
}

function mapTeamInviteRow(row: TeamInviteRow): FarmTeamInviteRecord {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    inviteCode: row.invite_code,
    label: row.label,
    teamRole: row.team_role,
    createdAt: row.created_at,
    claimedAt: row.claimed_at ?? undefined,
    isActive: row.is_active,
  };
}

function mapTeamMemberRecord(input: {
  row: TeamMemberRow;
  profile?: UserProfile | null;
}): FarmTeamMemberRecord {
  return {
    id: input.row.id,
    farmerId: input.row.farmer_id,
    staffUserId: input.row.staff_id,
    fullName: input.profile?.fullName ?? 'Farm team member',
    email: input.profile?.email ?? '',
    teamRole: input.row.team_role,
    status: input.row.status,
    createdAt: input.row.created_at,
  };
}

function sortAgronomists(entries: AgronomistDirectoryRecord[]) {
  const order = {
    available: 0,
    'field-visit': 1,
    busy: 2,
  } as const;

  return [...entries].sort((left, right) => {
    const availabilityDelta = order[left.availabilityStatus] - order[right.availabilityStatus];
    if (availabilityDelta !== 0) {
      return availabilityDelta;
    }

    return left.fullName.localeCompare(right.fullName);
  });
}

function seedDemoBoardUsers(): DemoCredential[] {
  return boardUsers.map((user) => ({
    id: `demo-${user.boardId}`,
    email: `${user.boardId}@ano.demo`,
    password: user.password,
    login: user.username,
    role: 'board',
    fullName: user.displayName,
    country: 'Zimbabwe',
    regionId: regions.find((region) => region.country === 'Zimbabwe')?.id ?? 'mash-west',
    boardId: user.boardId,
    locationDetail: undefined,
    whatsappNumber: undefined,
    specializationIds: [],
    availabilityStatus: undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

function seedDemoAgronomistUsers(): DemoCredential[] {
  return agronomistUsers.map((user) => ({
    id: `demo-agronomist-${user.username}`,
    email: user.email,
    password: user.password,
    login: user.username,
    role: 'agronomist',
    fullName: user.displayName,
    country: user.country,
    regionId: user.regionId,
    locationDetail: user.locationDetail,
    whatsappNumber: user.whatsappNumber,
    specializationIds: user.specializationIds,
    availabilityStatus: user.availabilityStatus,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

function seedDemoAdminUsers(): DemoCredential[] {
  return demoAdminUsers.map((user) => ({
    id: `demo-admin-${user.username}`,
    email: user.email,
    password: user.password,
    login: user.username,
    role: 'admin',
    fullName: user.displayName,
    country: 'Zimbabwe',
    regionId: regions.find((region) => region.country === 'Zimbabwe')?.id ?? 'mash-west',
    specializationIds: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

function readDemoUsers() {
  const stored = cacheGet<DemoCredential[]>(demoUsersKey, []);
  const seeds = [...seedDemoBoardUsers(), ...seedDemoAgronomistUsers(), ...seedDemoAdminUsers()];
  const merged = [...seeds];

  stored.forEach((user) => {
    if (!merged.some((seed) => seed.id === user.id)) {
      merged.push(user);
    }
  });

  cacheSet(demoUsersKey, merged);
  return merged;
}

function writeDemoUsers(users: DemoCredential[]) {
  cacheSet(demoUsersKey, users);
}

function readDemoSession() {
  return cacheGet<{ userId: string } | null>(demoSessionKey, null);
}

function writeDemoSession(userId: string | null) {
  cacheSet(demoSessionKey, userId ? { userId } : null);
}

function readDemoPlans() {
  return cacheGet<FarmerCropPlan[]>(demoPlansKey, []).map((plan) => ({
    ...plan,
    totalAreaHa: Number(plan.totalAreaHa ?? 0),
  }));
}

function writeDemoPlans(plans: FarmerCropPlan[]) {
  cacheSet(demoPlansKey, plans);
}

function readDemoPlantingEntries() {
  return cacheGet<PlantingProgressEntry[]>(demoPlantingEntriesKey, []).map((entry) => ({
    ...entry,
    areaHa: Number(entry.areaHa ?? 0),
  }));
}

function writeDemoPlantingEntries(entries: PlantingProgressEntry[]) {
  cacheSet(demoPlantingEntriesKey, entries);
}

function readDemoTransactions() {
  return cacheGet<BoardTransactionRecord[]>(demoTransactionsKey, []).map((transaction) => ({
    ...transaction,
    estimatedVolume: Number(transaction.estimatedVolume ?? 0),
    actualDeliveredVolume:
      transaction.actualDeliveredVolume === undefined ? undefined : Number(transaction.actualDeliveredVolume),
    estimatedGrossUsd:
      transaction.estimatedGrossUsd === undefined ? undefined : Number(transaction.estimatedGrossUsd),
    estimatedNetUsd: transaction.estimatedNetUsd === undefined ? undefined : Number(transaction.estimatedNetUsd),
  }));
}

function writeDemoTransactions(transactions: BoardTransactionRecord[]) {
  cacheSet(demoTransactionsKey, transactions);
}

function readDemoEnquiries() {
  return cacheGet<CropEnquiryRecord[]>(demoEnquiriesKey, []);
}

function writeDemoEnquiries(enquiries: CropEnquiryRecord[]) {
  cacheSet(demoEnquiriesKey, enquiries);
}

function readDemoTeamInvites() {
  return cacheGet<FarmTeamInviteRecord[]>(demoTeamInvitesKey, []);
}

function writeDemoTeamInvites(invites: FarmTeamInviteRecord[]) {
  cacheSet(demoTeamInvitesKey, invites);
}

function readDemoTeamMembers() {
  return cacheGet<FarmTeamMemberRecord[]>(demoTeamMembersKey, []);
}

function writeDemoTeamMembers(members: FarmTeamMemberRecord[]) {
  cacheSet(demoTeamMembersKey, members);
}

function findAutoRegistryMatch(profile: UserProfile, cropId: CropId) {
  return growerRegistry.find(
    (record) =>
      record.cropId === cropId &&
      record.regionId === profile.regionId &&
      record.name.trim().toLowerCase() === profile.fullName.trim().toLowerCase(),
  );
}

function resolveVerifiedLink(profile: UserProfile, cropId: CropId, growerId: string, pin: string) {
  return growerRegistry.find(
    (record) =>
      record.cropId === cropId &&
      record.boardId === cropBoardId(cropId) &&
      record.growerId.toLowerCase() === growerId.trim().toLowerCase() &&
      record.pin === pin.trim() &&
      (record.regionId === profile.regionId || record.name.trim().toLowerCase() === profile.fullName.trim().toLowerCase()),
  );
}

function getDemoTeamMembership(staffUserId: string) {
  return readDemoTeamMembers().find((member) => member.staffUserId === staffUserId) ?? null;
}

function withPendingCount(workspace: FarmerWorkspace): FarmerWorkspace {
  const pending = getPendingMutations().filter((mutation) => mutation.userId === workspace.profile.id).length;
  return {
    ...workspace,
    pendingSyncCount: pending,
  };
}

function withStaffPendingCount(workspace: StaffWorkspace): StaffWorkspace {
  const pending = getPendingMutations().filter((mutation) => mutation.userId === workspace.profile.id).length;
  return {
    ...workspace,
    pendingSyncCount: pending,
  };
}

function upsertPlanInCache(userId: string, plan: FarmerCropPlan) {
  const cacheKey = farmerWorkspaceCacheKey(userId);
  const workspace = readCachedFarmerWorkspace(userId);
  if (!workspace) {
    return;
  }

  const nextPlans = workspace.plans.some((current) => current.cropId === plan.cropId)
    ? workspace.plans.map((current) => (current.cropId === plan.cropId ? plan : current))
    : [plan, ...workspace.plans];

  cacheSet(
    cacheKey,
    withPendingCount({
      ...workspace,
      plans: nextPlans.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    }),
  );
}

function upsertPlantingEntryInCache(userId: string, entry: PlantingProgressEntry) {
  const cacheKey = farmerWorkspaceCacheKey(userId);
  const workspace = readCachedFarmerWorkspace(userId);
  if (!workspace) {
    return;
  }

  cacheSet(
    cacheKey,
    withPendingCount({
      ...workspace,
      plantingEntries: [entry, ...workspace.plantingEntries.filter((current) => current.id !== entry.id)].sort(
        (left, right) => right.entryDate.localeCompare(left.entryDate),
      ),
    }),
  );
}

function upsertTransactionInCache(userId: string, transaction: BoardTransactionRecord) {
  const cacheKey = farmerWorkspaceCacheKey(userId);
  const workspace = readCachedFarmerWorkspace(userId);
  if (!workspace) {
    return;
  }

  const nextTransactions = workspace.transactions.some((current) => current.cropId === transaction.cropId)
    ? workspace.transactions.map((current) => (current.cropId === transaction.cropId ? transaction : current))
    : [transaction, ...workspace.transactions];

  cacheSet(
    cacheKey,
    withPendingCount({
      ...workspace,
      transactions: nextTransactions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    }),
  );
}

function upsertEnquiryInCache(userId: string, enquiry: CropEnquiryRecord) {
  const cacheKey = farmerWorkspaceCacheKey(userId);
  const workspace = readCachedFarmerWorkspace(userId);
  if (!workspace) {
    return;
  }

  cacheSet(
    cacheKey,
    withPendingCount({
      ...workspace,
      enquiries: [enquiry, ...workspace.enquiries.filter((current) => current.id !== enquiry.id)],
    }),
  );
}

function upsertTeamInviteInCache(userId: string, invite: FarmTeamInviteRecord) {
  const workspace = readCachedFarmerWorkspace(userId);
  if (!workspace) {
    return;
  }

  const nextInvites = workspace.teamInvites.some((current) => current.id === invite.id)
    ? workspace.teamInvites.map((current) => (current.id === invite.id ? invite : current))
    : [invite, ...workspace.teamInvites];

  cacheSet(
    farmerWorkspaceCacheKey(userId),
    withPendingCount({
      ...workspace,
      teamInvites: nextInvites.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    }),
  );
}

function setTeamMembersInCache(userId: string, teamMembers: FarmTeamMemberRecord[]) {
  const workspace = readCachedFarmerWorkspace(userId);
  if (!workspace) {
    return;
  }

  cacheSet(
    farmerWorkspaceCacheKey(userId),
    withPendingCount({
      ...workspace,
      teamMembers,
    }),
  );
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

async function signedUrlForPath(path: string) {
  if (!firebaseStorage) {
    return undefined;
  }

  try {
    return await getDownloadURL(ref(firebaseStorage, `${cropEnquiryBucket}/${path}`));
  } catch {
    return undefined;
  }
}

async function ensureRemoteProfile() {
  if (!firebaseAuth) {
    return null;
  }

  const user = (await waitForFirebaseUser()) ?? firebaseAuth.currentUser;

  if (!user) {
    return null;
  }

  const existing = await readDocumentRow<ProfileRow>(userProfilesCollection, user.uid);
  if (existing) {
    return mapProfileRow(existing);
  }

  const fallbackRow: ProfileRow = {
    id: user.uid,
    email: user.email ?? '',
    role: 'farmer',
    full_name: user.displayName ?? '',
    farm_name: null,
    country: 'Zimbabwe',
    region_id: 'mash-west',
    board_id: null,
    soil_type: null,
    irrigation_method: null,
    location_detail: null,
    whatsapp_number: null,
    specialization_ids: [],
    availability_status: 'available',
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  await writeDocumentRow(userProfilesCollection, fallbackRow);
  return mapProfileRow(fallbackRow);
}

function demoAuthState(): AuthState {
  const session = readDemoSession();
  const users = readDemoUsers();
  const profile = session ? users.find((user) => user.id === session.userId) ?? null : null;
  return {
    profile: profile ?? null,
    backend: backendStatus(),
  };
}

async function onlineAuthState(): Promise<AuthState> {
  const profile = await ensureRemoteProfile();
  return {
    profile,
    backend: backendStatus(),
  };
}

export async function getAuthState(): Promise<AuthState> {
  if (!firebaseConfigured) {
    return demoAuthState();
  }

  return onlineAuthState();
}

export async function signUpFarmer(input: SignUpFarmerInput) {
  if (!firebaseConfigured) {
    const users = readDemoUsers();
    if (users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new Error('A farmer account with that email already exists in demo mode.');
    }

    const profile: DemoCredential = {
      id: makeId(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      login: input.email.trim().toLowerCase(),
      role: 'farmer',
      fullName: input.fullName.trim(),
      farmName: input.farmName.trim(),
      country: input.country,
      regionId: input.regionId,
      specializationIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    writeDemoUsers([profile, ...users]);
    writeDemoSession(profile.id);
    return { profile, requiresEmailConfirmation: false };
  }

  const credential = await createUserWithEmailAndPassword(
    firebaseAuth!,
    input.email.trim().toLowerCase(),
    input.password,
  );

  await updateProfile(credential.user, {
    displayName: input.fullName.trim(),
  });

  const createdAt = nowIso();
  const profileRow: ProfileRow = {
    id: credential.user.uid,
    email: input.email.trim().toLowerCase(),
    role: 'farmer',
    full_name: input.fullName.trim(),
    farm_name: input.farmName.trim(),
    country: input.country,
    region_id: input.regionId,
    board_id: null,
    soil_type: null,
    irrigation_method: null,
    location_detail: null,
    whatsapp_number: null,
    specialization_ids: [],
    availability_status: 'available',
    created_at: createdAt,
    updated_at: createdAt,
  };

  await writeDocumentRow(userProfilesCollection, profileRow);

  return {
    profile: mapProfileRow(profileRow),
    requiresEmailConfirmation: false,
  }
}

export async function signUpAgronomist(input: SignUpAgronomistInput) {
  if (!firebaseConfigured) {
    const users = readDemoUsers();
    if (users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new Error('An agronomist account with that email already exists in demo mode.');
    }

    const profile: DemoCredential = {
      id: makeId(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      login: input.email.trim().toLowerCase(),
      role: 'agronomist',
      fullName: input.fullName.trim(),
      country: input.country,
      regionId: input.regionId,
      locationDetail: input.locationDetail.trim(),
      whatsappNumber: input.whatsappNumber.trim(),
      specializationIds: input.specializationIds,
      availabilityStatus: input.availabilityStatus,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    writeDemoUsers([profile, ...users]);
    writeDemoSession(profile.id);
    return { profile, requiresEmailConfirmation: false };
  }

  const credential = await createUserWithEmailAndPassword(
    firebaseAuth!,
    input.email.trim().toLowerCase(),
    input.password,
  );

  await updateProfile(credential.user, {
    displayName: input.fullName.trim(),
  });

  const createdAt = nowIso();
  const profileRow: ProfileRow = {
    id: credential.user.uid,
    email: input.email.trim().toLowerCase(),
    role: 'agronomist',
    full_name: input.fullName.trim(),
    farm_name: null,
    country: input.country,
    region_id: input.regionId,
    board_id: null,
    soil_type: null,
    irrigation_method: null,
    location_detail: input.locationDetail.trim(),
    whatsapp_number: input.whatsappNumber.trim(),
    specialization_ids: input.specializationIds,
    availability_status: input.availabilityStatus,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await writeDocumentRow(userProfilesCollection, profileRow);

  return {
    profile: mapProfileRow(profileRow),
    requiresEmailConfirmation: false,
  }
}

export async function signUpStaff(input: SignUpStaffInput) {
  if (!firebaseConfigured) {
    const invite = readDemoTeamInvites().find(
      (entry) => entry.inviteCode.toLowerCase() === input.inviteCode.trim().toLowerCase() && entry.isActive,
    );
    if (!invite) {
      throw new Error('That team invite code is not active.');
    }

    const farmer = readDemoUsers().find((user) => user.id === invite.farmerId && user.role === 'farmer');
    if (!farmer) {
      throw new Error('The farmer attached to this invite could not be found.');
    }

    const users = readDemoUsers();
    if (users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new Error('A staff account with that email already exists in demo mode.');
    }

    const createdAt = nowIso();
    const profile: DemoCredential = {
      id: makeId(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      login: input.email.trim().toLowerCase(),
      role: 'staff',
      fullName: input.fullName.trim(),
      country: farmer.country,
      regionId: farmer.regionId,
      createdAt,
      updatedAt: createdAt,
    };

    const member: FarmTeamMemberRecord = {
      id: makeId(),
      farmerId: farmer.id,
      staffUserId: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      teamRole: invite.teamRole,
      status: 'active',
      createdAt,
    };

    writeDemoUsers([profile, ...users]);
    writeDemoTeamMembers([member, ...readDemoTeamMembers()]);
    writeDemoTeamInvites(
      readDemoTeamInvites().map((entry) =>
        entry.id === invite.id
          ? {
              ...entry,
              isActive: false,
              claimedAt: createdAt,
            }
          : entry,
      ),
    );
    writeDemoSession(profile.id);
    return { profile, requiresEmailConfirmation: false };
  }

  const inviteCode = normalizeInviteCode(input.inviteCode);
  const invite = await readDocumentRow<TeamInviteRow>(teamInvitesCollection, inviteCode);

  if (!invite || !invite.is_active) {
    throw new Error('That team invite code is not active.');
  }

  const farmer = await readDocumentRow<ProfileRow>(userProfilesCollection, invite.farmer_id);
  if (!farmer) {
    throw new Error('The farmer attached to this invite could not be found.');
  }

  const credential = await createUserWithEmailAndPassword(
    firebaseAuth!,
    input.email.trim().toLowerCase(),
    input.password,
  );

  await updateProfile(credential.user, {
    displayName: input.fullName.trim(),
  });

  const createdAt = nowIso();
  const profileRow: ProfileRow = {
    id: credential.user.uid,
    email: input.email.trim().toLowerCase(),
    role: 'staff',
    full_name: input.fullName.trim(),
    farm_name: null,
    country: farmer.country,
    region_id: farmer.region_id,
    board_id: null,
    soil_type: null,
    irrigation_method: null,
    location_detail: null,
    whatsapp_number: null,
    specialization_ids: [],
    availability_status: 'available',
    created_at: createdAt,
    updated_at: createdAt,
  };
  const teamMemberRow: TeamMemberRow = {
    id: credential.user.uid,
    farmer_id: farmer.id,
    staff_id: credential.user.uid,
    team_role: invite.team_role,
    invite_code: invite.id,
    status: 'active',
    created_at: createdAt,
  };

  const batch = writeBatch(firebaseDb!);
  batch.set(doc(firebaseDb!, userProfilesCollection, profileRow.id), omitId(profileRow));
  batch.set(doc(firebaseDb!, teamMembersCollection, teamMemberRow.id), omitId(teamMemberRow));
  batch.update(doc(firebaseDb!, teamInvitesCollection, invite.id), {
    is_active: false,
    claimed_at: createdAt,
  });
  await batch.commit();

  return {
    profile: mapProfileRow(profileRow),
    requiresEmailConfirmation: false,
  };
}

export async function signIn(input: SignInInput) {
  if (!firebaseConfigured) {
    const users = readDemoUsers();
    const login = input.login.trim().toLowerCase();
    const profile =
      users.find((user) => user.email.toLowerCase() === login || user.login.toLowerCase() === login) ??
      null;

    if (!profile || profile.password !== input.password) {
      throw new Error(
        'Login failed. Use a known farmer, staff, agronomist, or admin email, or one of the demo board, agronomist, or admin usernames.',
      );
    }

    writeDemoSession(profile.id);
    return profile;
  }

  const login = input.login.trim().toLowerCase();
  if (!login.includes('@')) {
    throw new Error('Live sign-in expects an email address for Firebase Auth.');
  }

  await signInWithEmailAndPassword(firebaseAuth!, login, input.password);

  return ensureRemoteProfile();
}

export async function signOut() {
  if (!firebaseConfigured) {
    writeDemoSession(null);
    return;
  }

  await firebaseSignOutUser(firebaseAuth!);
}

function buildOptimisticPlan(
  profile: UserProfile,
  input: CropPlanInput,
  overrides?: Partial<FarmerCropPlan>,
): FarmerCropPlan {
  const autoMatch = findAutoRegistryMatch(profile, input.cropId);
  return {
    id: overrides?.id ?? makeId(),
    farmerId: profile.id,
    cropId: input.cropId,
    boardId: cropBoardId(input.cropId),
    varietyName: overrides?.varietyName ?? input.varietyName,
    plantingDate: input.plantingDate,
    totalAreaHa: overrides?.totalAreaHa ?? input.totalAreaHa,
    growerId: overrides?.growerId ?? autoMatch?.growerId,
    boardStatus: overrides?.boardStatus ?? (autoMatch ? 'verified' : 'not-linked'),
    verificationSource: overrides?.verificationSource ?? (autoMatch ? 'registry-auto' : 'manual'),
    createdAt: overrides?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    syncState: overrides?.syncState ?? 'synced',
  };
}

function buildOptimisticPlantingEntry(
  profile: UserProfile,
  planId: string,
  input: PlantingProgressInput,
  syncState: SyncState,
): PlantingProgressEntry {
  return {
    id: makeId(),
    planId,
    farmerId: profile.id,
    cropId: input.cropId,
    entryDate: input.entryDate,
    areaHa: input.areaHa,
    createdAt: nowIso(),
    syncState,
  };
}

function buildOptimisticEnquiry(
  profile: UserProfile,
  input: CropEnquiryInput,
  imageUrl?: string,
): CropEnquiryRecord {
  return {
    id: makeId(),
    farmerId: profile.id,
    cropId: input.cropId,
    boardId: cropBoardId(input.cropId),
    issueId: input.issueId,
    note: input.note.trim(),
    imageUrl,
    createdAt: nowIso(),
    syncState: 'pending',
  };
}

function readCachedFarmerWorkspace(userId: string) {
  const cached = cacheGet<FarmerWorkspace | null>(farmerWorkspaceCacheKey(userId), null);
  if (!cached) {
    return null;
  }

  return {
    ...cached,
    agronomists: cached.agronomists ?? [],
    teamInvites: cached.teamInvites ?? [],
    teamMembers: cached.teamMembers ?? [],
    plantingEntries: cached.plantingEntries ?? [],
    transactions: cached.transactions ?? [],
  };
}

function readCachedBoardWorkspace(userId: string) {
  return cacheGet<BoardWorkspace | null>(boardWorkspaceCacheKey(userId), null);
}

function readCachedAgronomistWorkspace(userId: string) {
  return cacheGet<AgronomistWorkspace | null>(agronomistWorkspaceCacheKey(userId), null);
}

function readCachedStaffWorkspace(userId: string) {
  return cacheGet<StaffWorkspace | null>(staffWorkspaceCacheKey(userId), null);
}

export async function loadFarmerWorkspace(profile: UserProfile): Promise<FarmerWorkspace> {
  if (!firebaseConfigured) {
    const plans = readDemoPlans()
      .filter((plan) => plan.farmerId === profile.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const plantingEntries = readDemoPlantingEntries()
      .filter((entry) => entry.farmerId === profile.id)
      .sort((left, right) => right.entryDate.localeCompare(left.entryDate));
    const transactions = readDemoTransactions()
      .filter((transaction) => transaction.farmerId === profile.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const enquiries = readDemoEnquiries()
      .filter((enquiry) => enquiry.farmerId === profile.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const agronomists = sortAgronomists(
      readDemoUsers()
        .filter((user) => user.role === 'agronomist' && user.country === profile.country)
        .map((user) => mapAgronomistDirectoryEntry(user)),
    );
    const teamInvites = readDemoTeamInvites()
      .filter((invite) => invite.farmerId === profile.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const teamMembers = readDemoTeamMembers()
      .filter((member) => member.farmerId === profile.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const workspace = withPendingCount({
      profile,
      plans,
      plantingEntries,
      transactions,
      enquiries,
      agronomists,
      teamInvites,
      teamMembers,
      pendingSyncCount: 0,
    });
    cacheSet(farmerWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  }

  try {
    const [planRows, plantingRows, transactionRows, enquiryRows, agronomistRows, inviteRows, memberRows] =
      await Promise.all([
        readCollectionRows<PlanRow>(farmerPlansCollection, where('farmer_id', '==', profile.id)),
        readCollectionRows<PlantingRow>(plantingEntriesCollection, where('farmer_id', '==', profile.id)),
        readCollectionRows<TransactionRow>(transactionsCollection, where('farmer_id', '==', profile.id)),
        readCollectionRows<EnquiryRow>(enquiriesCollection, where('farmer_id', '==', profile.id)),
        readCollectionRows<ProfileRow>(
          userProfilesCollection,
          where('role', '==', 'agronomist'),
          where('country', '==', profile.country),
        ),
        readCollectionRows<TeamInviteRow>(teamInvitesCollection, where('farmer_id', '==', profile.id)),
        readCollectionRows<TeamMemberRow>(teamMembersCollection, where('farmer_id', '==', profile.id)),
      ]);

    const staffProfiles = await Promise.all(
      [...new Set(memberRows.map((member) => member.staff_id))].map(async (staffId) =>
        readDocumentRow<ProfileRow>(userProfilesCollection, staffId),
      ),
    );
    const staffProfileMap = new Map(
      staffProfiles.filter((row): row is ProfileRow => Boolean(row)).map((row) => [row.id, mapProfileRow(row)]),
    );

    const enquiries = await Promise.all(
      enquiryRows
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map(async (row) =>
          mapEnquiryRow(row, row.image_path ? await signedUrlForPath(row.image_path) : undefined),
        ),
    );

    const workspace = withPendingCount({
      profile,
      plans: planRows
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map((row) => mapPlanRow(row)),
      plantingEntries: plantingRows
        .sort((left, right) => right.entry_date.localeCompare(left.entry_date))
        .map((row) => mapPlantingRow(row)),
      transactions: transactionRows
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map((row) => mapTransactionRow(row)),
      enquiries,
      agronomists: sortAgronomists(
        agronomistRows
          .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
          .map((row) => mapAgronomistDirectoryEntry(mapProfileRow(row))),
      ),
      teamInvites: inviteRows
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((row) => mapTeamInviteRow(row)),
      teamMembers: memberRows
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((row) =>
          mapTeamMemberRecord({
            row,
            profile: staffProfileMap.get(row.staff_id),
          }),
        ),
      pendingSyncCount: 0,
    });

    cacheSet(farmerWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  } catch (error) {
    const cached = readCachedFarmerWorkspace(profile.id);
    if (cached) {
      return withPendingCount(cached);
    }

    throw error;
  }
}

export async function loadStaffWorkspace(profile: UserProfile): Promise<StaffWorkspace> {
  if (!firebaseConfigured) {
    const membership = getDemoTeamMembership(profile.id);
    if (!membership) {
      throw new Error('This staff account is not linked to a farmer yet.');
    }

    const farmer = readDemoUsers().find((user) => user.id === membership.farmerId && user.role === 'farmer') ?? null;
    if (!farmer) {
      throw new Error('The linked farmer account could not be found.');
    }

    const workspace = withStaffPendingCount({
      profile,
      farmer,
      membership,
      plans: readDemoPlans().filter((plan) => plan.farmerId === farmer.id),
      plantingEntries: readDemoPlantingEntries().filter((entry) => entry.farmerId === farmer.id),
      transactions: readDemoTransactions().filter((transaction) => transaction.farmerId === farmer.id),
      enquiries: readDemoEnquiries().filter((enquiry) => enquiry.farmerId === farmer.id),
      pendingSyncCount: 0,
    });
    cacheSet(staffWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  }

  try {
    const membershipData =
      (await readDocumentRow<TeamMemberRow>(teamMembersCollection, profile.id)) ??
      (await readCollectionRow<TeamMemberRow>(
        teamMembersCollection,
        where('staff_id', '==', profile.id),
      ));

    if (!membershipData) {
      throw new Error('This staff account is not linked to a farmer yet.');
    }

    const farmerProfileData = await readDocumentRow<ProfileRow>(
      userProfilesCollection,
      membershipData.farmer_id,
    );

    if (!farmerProfileData) {
      throw new Error('The linked farmer account could not be found.');
    }

    const farmer = mapProfileRow(farmerProfileData);

    const [planRows, plantingRows, transactionRows, enquiryRows] = await Promise.all([
      readCollectionRows<PlanRow>(farmerPlansCollection, where('farmer_id', '==', farmer.id)),
      readCollectionRows<PlantingRow>(plantingEntriesCollection, where('farmer_id', '==', farmer.id)),
      readCollectionRows<TransactionRow>(transactionsCollection, where('farmer_id', '==', farmer.id)),
      readCollectionRows<EnquiryRow>(enquiriesCollection, where('farmer_id', '==', farmer.id)),
    ]);

    const enquiries = await Promise.all(
      enquiryRows
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map(async (row) =>
          mapEnquiryRow(row, row.image_path ? await signedUrlForPath(row.image_path) : undefined),
        ),
    );

    const workspace = withStaffPendingCount({
      profile,
      farmer,
      membership: mapTeamMemberRecord({
        row: membershipData,
        profile,
      }),
      plans: planRows
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map((row) => mapPlanRow(row)),
      plantingEntries: plantingRows
        .sort((left, right) => right.entry_date.localeCompare(left.entry_date))
        .map((row) => mapPlantingRow(row)),
      transactions: transactionRows
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map((row) => mapTransactionRow(row)),
      enquiries,
      pendingSyncCount: 0,
    });
    cacheSet(staffWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  } catch (error) {
    const cached = readCachedStaffWorkspace(profile.id);
    if (cached) {
      return withStaffPendingCount(cached);
    }

    throw error;
  }
}

export async function loadAgronomistWorkspace(profile: UserProfile): Promise<AgronomistWorkspace> {
  if (!firebaseConfigured) {
    const farmers = readDemoUsers().filter(
      (user) => user.role === 'farmer' && user.country === profile.country && user.regionId === profile.regionId,
    );
    const farmerMap = new Map(farmers.map((farmer) => [farmer.id, farmer]));
    const regionalFarmers = readDemoPlans()
      .filter((plan) => farmerMap.has(plan.farmerId))
      .map<AgronomistFarmerSummary>((plan) => {
        const farmer = farmerMap.get(plan.farmerId);
        return {
          farmerId: plan.farmerId,
          fullName: farmer?.fullName ?? 'Unknown grower',
          email: farmer?.email ?? '',
          regionId: farmer?.regionId ?? profile.regionId,
          cropId: plan.cropId,
          plantingDate: plan.plantingDate,
          totalAreaHa: plan.totalAreaHa,
          boardStatus: plan.boardStatus,
        };
      });
    const regionalCases = readDemoEnquiries()
      .filter((enquiry) => farmerMap.has(enquiry.farmerId))
      .map<AgronomistCaseRecord>((enquiry) => {
        const farmer = farmerMap.get(enquiry.farmerId);
        return {
          id: enquiry.id,
          farmerId: enquiry.farmerId,
          farmerName: farmer?.fullName ?? 'Unknown grower',
          farmerEmail: farmer?.email ?? '',
          regionId: farmer?.regionId ?? profile.regionId,
          cropId: enquiry.cropId,
          boardId: enquiry.boardId,
          issueId: enquiry.issueId,
          note: enquiry.note,
          imageUrl: enquiry.imageUrl,
          createdAt: enquiry.createdAt,
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const workspace = {
      profile,
      regionalFarmers,
      regionalCases,
    };
    cacheSet(agronomistWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  }

  try {
    const farmerProfiles = (
      await readCollectionRows<ProfileRow>(
        userProfilesCollection,
        where('role', '==', 'farmer'),
        where('country', '==', profile.country),
        where('region_id', '==', profile.regionId),
      )
    ).map((row) => mapProfileRow(row));
    const farmerIds = farmerProfiles.map((farmer) => farmer.id);
    const farmerMap = new Map(farmerProfiles.map((farmer) => [farmer.id, farmer]));

    const [planGroups, enquiryGroups] = await Promise.all([
      Promise.all(
        farmerIds.map((farmerId) =>
          readCollectionRows<PlanRow>(farmerPlansCollection, where('farmer_id', '==', farmerId)),
        ),
      ),
      Promise.all(
        farmerIds.map((farmerId) =>
          readCollectionRows<EnquiryRow>(enquiriesCollection, where('farmer_id', '==', farmerId)),
        ),
      ),
    ]);
    const planRows = planGroups.flat();
    const enquiryRows = enquiryGroups.flat();

    const regionalFarmers = planRows
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .map<AgronomistFarmerSummary>((plan) => {
      const farmer = farmerMap.get(plan.farmer_id);
      return {
        farmerId: plan.farmer_id,
        fullName: farmer?.fullName ?? 'Unknown grower',
        email: farmer?.email ?? '',
        regionId: farmer?.regionId ?? profile.regionId,
        cropId: plan.crop_id,
        plantingDate: plan.planting_date,
        totalAreaHa: Number(plan.total_area_ha ?? 0),
        boardStatus: plan.board_status,
      };
    });

    const regionalCases = await Promise.all(
      enquiryRows
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map(async (row) => {
        const farmer = farmerMap.get(row.farmer_id);
        return {
          id: row.id,
          farmerId: row.farmer_id,
          farmerName: farmer?.fullName ?? 'Unknown grower',
          farmerEmail: farmer?.email ?? '',
          regionId: farmer?.regionId ?? profile.regionId,
          cropId: row.crop_id,
          boardId: row.board_id,
          issueId: row.issue_id,
          note: row.note,
          imageUrl: row.image_path ? await signedUrlForPath(row.image_path) : undefined,
          createdAt: row.created_at,
        } satisfies AgronomistCaseRecord;
      }),
    );

    const workspace = {
      profile,
      regionalFarmers,
      regionalCases,
    };
    cacheSet(agronomistWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  } catch (error) {
    const cached = readCachedAgronomistWorkspace(profile.id);
    if (cached) {
      return cached;
    }

    throw error;
  }
}

export async function loadBoardWorkspace(profile: UserProfile): Promise<BoardWorkspace> {
  if (!profile.boardId) {
    return {
      profile,
      growers: [],
      transactions: [],
      enquiries: [],
    };
  }

  if (!firebaseConfigured) {
    const farmers = readDemoUsers().filter((user) => user.role === 'farmer');
    const plans = readDemoPlans().filter((plan) => plan.boardId === profile.boardId);
    const growers = plans.map<BoardGrowerSummary>((plan) => {
      const farmer = farmers.find((entry) => entry.id === plan.farmerId);
      return {
        farmerId: plan.farmerId,
        fullName: farmer?.fullName ?? 'Unknown grower',
        email: farmer?.email ?? '',
        regionId: farmer?.regionId ?? 'mash-west',
        cropId: plan.cropId,
        plantingDate: plan.plantingDate,
        totalAreaHa: plan.totalAreaHa,
        boardStatus: plan.boardStatus,
        growerId: plan.growerId,
      };
    });

    const enquiries = readDemoEnquiries().filter((enquiry) => enquiry.boardId === profile.boardId);
    const transactions = readDemoTransactions().filter((transaction) => transaction.boardId === profile.boardId);
    const workspace = {
      profile,
      growers,
      transactions,
      enquiries,
    };
    cacheSet(boardWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  }

  try {
    const plans = (
      await readCollectionRows<PlanRow>(
        farmerPlansCollection,
        where('board_id', '==', profile.boardId),
      )
    ).sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    const farmerIds = [...new Set(plans.map((plan) => plan.farmer_id))];

    const [profileRows, transactionRows, enquiryRows] = await Promise.all([
      Promise.all(farmerIds.map(async (farmerId) => readDocumentRow<ProfileRow>(userProfilesCollection, farmerId))),
      readCollectionRows<TransactionRow>(transactionsCollection, where('board_id', '==', profile.boardId)),
      readCollectionRows<EnquiryRow>(enquiriesCollection, where('board_id', '==', profile.boardId)),
    ]);

    const profileMap = new Map(
      profileRows
        .filter((row): row is ProfileRow => Boolean(row))
        .map((row) => [row.id, mapProfileRow(row)]),
    );

    const enquiries = await Promise.all(
      enquiryRows
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map(async (row) =>
          mapEnquiryRow(
            row,
            row.image_path ? await signedUrlForPath(row.image_path) : undefined,
          ),
        ),
    );

    const workspace = {
      profile,
      growers: plans.map((plan) => {
        const farmer = profileMap.get(plan.farmer_id);
        return {
          farmerId: plan.farmer_id,
          fullName: farmer?.fullName ?? 'Unknown grower',
          email: farmer?.email ?? '',
          regionId: farmer?.regionId ?? 'mash-west',
          cropId: plan.crop_id,
          plantingDate: plan.planting_date,
          totalAreaHa: Number(plan.total_area_ha ?? 0),
          boardStatus: plan.board_status,
          growerId: plan.grower_id ?? undefined,
        } satisfies BoardGrowerSummary;
      }),
      transactions: transactionRows
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map((row) => mapTransactionRow(row)),
      enquiries,
    };

    cacheSet(boardWorkspaceCacheKey(profile.id), workspace);
    return workspace;
  } catch (error) {
    const cached = readCachedBoardWorkspace(profile.id);
    if (cached) {
      return cached;
    }

    throw error;
  }
}

function queueMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt'>) {
  pushPendingMutation({
    ...mutation,
    id: makeId(),
    createdAt: nowIso(),
  });
}

export async function saveFarmerProfile(profile: UserProfile, updates: Partial<UserProfile>) {
  const nextProfile = {
    ...profile,
    ...updates,
    updatedAt: nowIso(),
  };

  if (!firebaseConfigured) {
    const users = readDemoUsers();
    const updatedUsers = users.map((user) =>
      user.id === profile.id
        ? {
            ...user,
            ...updates,
            updatedAt: nextProfile.updatedAt,
          }
        : user,
    );
    writeDemoUsers(updatedUsers);
    return nextProfile;
  }

  if (!isBrowserOnline()) {
    queueMutation({
      type: 'profile-update',
      userId: profile.id,
      payload: {
        fullName: nextProfile.fullName,
        farmName: nextProfile.farmName ?? '',
        country: nextProfile.country,
        regionId: nextProfile.regionId,
        soilType: nextProfile.soilType ?? 'loam',
        irrigationMethod: nextProfile.irrigationMethod ?? 'sprinkler',
        locationDetail: nextProfile.locationDetail ?? '',
        whatsappNumber: nextProfile.whatsappNumber ?? '',
        specializationIds: nextProfile.specializationIds ?? [],
        availabilityStatus: nextProfile.availabilityStatus ?? 'available',
      },
    });
    return nextProfile;
  }

  try {
    await writeDocumentRow(userProfilesCollection, {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: nextProfile.fullName,
      farm_name: nextProfile.farmName ?? null,
      country: nextProfile.country,
      region_id: nextProfile.regionId,
      board_id: nextProfile.boardId ?? null,
      soil_type: nextProfile.soilType ?? null,
      irrigation_method: nextProfile.irrigationMethod ?? null,
      location_detail: nextProfile.locationDetail ?? null,
      whatsapp_number: nextProfile.whatsappNumber ?? null,
      specialization_ids: nextProfile.specializationIds ?? [],
      availability_status: nextProfile.availabilityStatus ?? 'available',
      created_at: profile.createdAt,
      updated_at: nextProfile.updatedAt,
    } satisfies ProfileRow);
  } catch {
    queueMutation({
      type: 'profile-update',
      userId: profile.id,
      payload: {
        fullName: nextProfile.fullName,
        farmName: nextProfile.farmName ?? '',
        country: nextProfile.country,
        regionId: nextProfile.regionId,
        soilType: nextProfile.soilType ?? 'loam',
        irrigationMethod: nextProfile.irrigationMethod ?? 'sprinkler',
        locationDetail: nextProfile.locationDetail ?? '',
        whatsappNumber: nextProfile.whatsappNumber ?? '',
        specializationIds: nextProfile.specializationIds ?? [],
        availabilityStatus: nextProfile.availabilityStatus ?? 'available',
      },
    });
  }

  return nextProfile;
}

async function resolveStaffMembership(profile: UserProfile) {
  if (profile.role !== 'staff') {
    return null;
  }

  if (!firebaseConfigured) {
    return getDemoTeamMembership(profile.id);
  }

  const cached = readCachedStaffWorkspace(profile.id)?.membership;
  if (cached) {
    return cached;
  }

  const data =
    (await readDocumentRow<TeamMemberRow>(teamMembersCollection, profile.id)) ??
    (await readCollectionRow<TeamMemberRow>(
      teamMembersCollection,
      where('staff_id', '==', profile.id),
    ));

  if (!data) {
    throw new Error('This staff account is not linked to a farmer yet.');
  }

  return mapTeamMemberRecord({
    row: data,
    profile,
  });
}

export async function createFarmTeamInvite(profile: UserProfile, input: FarmTeamInviteInput) {
  const inviteCode = makeInviteCode();
  const optimistic: FarmTeamInviteRecord = {
    id: inviteCode,
    farmerId: profile.id,
    inviteCode,
    label: input.label.trim(),
    teamRole: input.teamRole,
    createdAt: nowIso(),
    isActive: true,
  };

  if (!firebaseConfigured) {
    writeDemoTeamInvites([optimistic, ...readDemoTeamInvites()]);
    upsertTeamInviteInCache(profile.id, optimistic);
    return optimistic;
  }

  if (!isBrowserOnline()) {
    queueMutation({
      type: 'team-invite-create',
      userId: profile.id,
      payload: optimistic,
    });
    upsertTeamInviteInCache(profile.id, optimistic);
    return optimistic;
  }

  try {
    const row: TeamInviteRow = {
      id: optimistic.id,
      farmer_id: profile.id,
      invite_code: optimistic.inviteCode,
      label: optimistic.label,
      team_role: optimistic.teamRole,
      created_at: optimistic.createdAt,
      claimed_at: null,
      is_active: true,
    };
    await writeDocumentRow(teamInvitesCollection, row, false);
    const saved = mapTeamInviteRow(row);
    upsertTeamInviteInCache(profile.id, saved);
    return saved;
  } catch {
    queueMutation({
      type: 'team-invite-create',
      userId: profile.id,
      payload: optimistic,
    });
    upsertTeamInviteInCache(profile.id, optimistic);
    return optimistic;
  }
}

async function savePlanRemote(profile: UserProfile, input: CropPlanInput) {
  const existing = await readCollectionRow<PlanRow>(
    farmerPlansCollection,
    where('farmer_id', '==', profile.id),
    where('crop_id', '==', input.cropId),
  );
  const autoMatch = findAutoRegistryMatch(profile, input.cropId);
  const row: PlanRow = {
    id: existing?.id ?? makeId(),
    farmer_id: profile.id,
    crop_id: input.cropId,
    board_id: cropBoardId(input.cropId),
    variety_name: input.varietyName?.trim() || existing?.variety_name || null,
    planting_date: input.plantingDate,
    total_area_ha: input.totalAreaHa,
    grower_id: existing?.grower_id ?? autoMatch?.growerId ?? null,
    board_status: existing?.board_status ?? (autoMatch ? 'verified' : 'not-linked'),
    verification_source: existing?.verification_source ?? (autoMatch ? 'registry-auto' : 'manual'),
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await writeDocumentRow(farmerPlansCollection, row);
  return mapPlanRow(row);
}

async function linkPlanRemote(profile: UserProfile, input: BoardLinkInput) {
  const existing = await readCollectionRow<PlanRow>(
    farmerPlansCollection,
    where('farmer_id', '==', profile.id),
    where('crop_id', '==', input.cropId),
  );
  const verified = resolveVerifiedLink(profile, input.cropId, input.growerId, input.pin);
  const row: PlanRow = {
    id: existing?.id ?? makeId(),
    farmer_id: profile.id,
    crop_id: input.cropId,
    board_id: cropBoardId(input.cropId),
    variety_name: existing?.variety_name ?? null,
    planting_date: existing?.planting_date ?? new Date().toISOString().slice(0, 10),
    total_area_ha: existing?.total_area_ha ?? 0,
    grower_id: input.growerId.trim(),
    board_status: verified ? 'verified' : 'linked',
    verification_source: verified ? 'registry-pin' : 'manual-link',
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await writeDocumentRow(farmerPlansCollection, row);
  return mapPlanRow(row);
}

async function savePlantingRecordRemote(
  profile: UserProfile,
  input: PlantingProgressInput,
  targetFarmerId: string = profile.id,
) {
  const planRow = await readCollectionRow<PlanRow>(
    farmerPlansCollection,
    where('farmer_id', '==', targetFarmerId),
    where('crop_id', '==', input.cropId),
  );

  if (!planRow) {
    throw new Error('Save the crop plan before recording planting progress.');
  }

  const row: PlantingRow = {
    id: makeId(),
    plan_id: planRow.id,
    farmer_id: targetFarmerId,
    crop_id: input.cropId,
    entry_date: input.entryDate,
    area_ha: input.areaHa,
    created_at: nowIso(),
  };

  await writeDocumentRow(plantingEntriesCollection, row, false);
  return mapPlantingRow(row);
}

async function saveTransactionRemote(
  profile: UserProfile,
  input: BoardTransactionInput,
  existing?: BoardTransactionRecord | null,
) {
  const boardId = cropBoardId(input.cropId);
  const currentRow =
    existing
      ? ({
          id: existing.id,
          farmer_id: existing.farmerId,
          crop_id: existing.cropId,
          board_id: existing.boardId,
          delivery_point: existing.deliveryPoint,
          target_delivery_date: existing.targetDeliveryDate,
          estimated_volume: existing.estimatedVolume,
          actual_delivered_volume: existing.actualDeliveredVolume ?? null,
          estimated_gross_usd: existing.estimatedGrossUsd ?? null,
          estimated_net_usd: existing.estimatedNetUsd ?? null,
          delivery_status: existing.deliveryStatus,
          payment_status: existing.paymentStatus,
          payment_due_date: existing.paymentDueDate ?? null,
          payment_reference: existing.paymentReference ?? null,
          notes: existing.notes,
          created_at: existing.createdAt,
          updated_at: existing.updatedAt,
        } satisfies TransactionRow)
      : await readCollectionRow<TransactionRow>(
          transactionsCollection,
          where('farmer_id', '==', profile.id),
          where('crop_id', '==', input.cropId),
        );
  const row: TransactionRow = {
    id: currentRow?.id ?? makeId(),
    farmer_id: profile.id,
    crop_id: input.cropId,
    board_id: boardId,
    delivery_point: input.deliveryPoint,
    target_delivery_date: input.targetDeliveryDate,
    estimated_volume: input.estimatedVolume,
    actual_delivered_volume: currentRow?.actual_delivered_volume ?? null,
    estimated_gross_usd: input.estimatedGrossUsd ?? null,
    estimated_net_usd: input.estimatedNetUsd ?? null,
    delivery_status: currentRow?.delivery_status ?? 'booked',
    payment_status: currentRow?.payment_status ?? 'awaiting-board',
    payment_due_date: currentRow?.payment_due_date ?? null,
    payment_reference: currentRow?.payment_reference ?? null,
    notes: input.notes.trim(),
    created_at: currentRow?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await writeDocumentRow(transactionsCollection, row);
  return mapTransactionRow(row);
}

export async function saveCropPlan(profile: UserProfile, input: CropPlanInput) {
  if (!firebaseConfigured) {
    const existing = readDemoPlans();
    const optimistic = buildOptimisticPlan(profile, input);
    const nextPlans = existing.some((plan) => plan.farmerId === profile.id && plan.cropId === input.cropId)
      ? existing.map((plan) =>
          plan.farmerId === profile.id && plan.cropId === input.cropId ? optimistic : plan,
        )
      : [optimistic, ...existing];
    writeDemoPlans(nextPlans);
    upsertPlanInCache(profile.id, optimistic);
    return optimistic;
  }

  const optimistic = buildOptimisticPlan(profile, input, {
    syncState: isBrowserOnline() ? 'synced' : 'pending',
  });
  upsertPlanInCache(profile.id, optimistic);

  if (!isBrowserOnline()) {
    queueMutation({
      type: 'plan-upsert',
      userId: profile.id,
      payload: input,
    });
    return {
      ...optimistic,
      syncState: 'pending',
    };
  }

  try {
    const saved = await savePlanRemote(profile, input);
    upsertPlanInCache(profile.id, saved);
    return saved;
  } catch {
    queueMutation({
      type: 'plan-upsert',
      userId: profile.id,
      payload: input,
    });
    const pendingPlan = {
      ...optimistic,
      syncState: 'pending' as const,
    };
    upsertPlanInCache(profile.id, pendingPlan);
    return pendingPlan;
  }
}

export async function recordPlantingProgress(profile: UserProfile, input: PlantingProgressInput) {
  const membership = await resolveStaffMembership(profile);
  const targetFarmerId = membership?.farmerId ?? profile.id;

  if (!firebaseConfigured) {
    const plan =
      readDemoPlans().find((entry) => entry.farmerId === targetFarmerId && entry.cropId === input.cropId) ?? null;

    if (!plan) {
      throw new Error('Save the crop plan before recording planting progress.');
    }

    const entry = buildOptimisticPlantingEntry({ ...profile, id: targetFarmerId }, plan.id, input, 'synced');
    writeDemoPlantingEntries([entry, ...readDemoPlantingEntries()]);
    if (profile.role === 'farmer') {
      upsertPlantingEntryInCache(profile.id, entry);
    }
    return entry;
  }

  const planId =
    (profile.role === 'staff'
      ? readCachedStaffWorkspace(profile.id)?.plans.find((entry) => entry.cropId === input.cropId)?.id
      : readCachedFarmerWorkspace(profile.id)?.plans.find((entry) => entry.cropId === input.cropId)?.id) ?? makeId();
  const optimistic = buildOptimisticPlantingEntry(
    { ...profile, id: targetFarmerId },
    planId,
    input,
    isBrowserOnline() ? 'synced' : 'pending',
  );
  if (profile.role === 'farmer') {
    upsertPlantingEntryInCache(profile.id, optimistic);
  }

  if (!isBrowserOnline()) {
    queueMutation({
      type: 'planting-record',
      userId: profile.id,
      payload: {
        input,
        targetFarmerId,
      },
    });
    return {
      ...optimistic,
      syncState: 'pending',
    };
  }

  try {
    const saved = await savePlantingRecordRemote(profile, input, targetFarmerId);
    if (profile.role === 'farmer') {
      upsertPlantingEntryInCache(profile.id, saved);
    }
    return saved;
  } catch {
    queueMutation({
      type: 'planting-record',
      userId: profile.id,
      payload: {
        input,
        targetFarmerId,
      },
    });
    const pendingEntry = {
      ...optimistic,
      syncState: 'pending' as const,
    };
    if (profile.role === 'farmer') {
      upsertPlantingEntryInCache(profile.id, pendingEntry);
    }
    return pendingEntry;
  }
}

export async function saveBoardTransaction(profile: UserProfile, input: BoardTransactionInput) {
  const previousTransaction =
    readCachedFarmerWorkspace(profile.id)?.transactions.find((plan) => plan.cropId === input.cropId) ?? null;
  const optimistic = buildTransactionDraft({
    id: previousTransaction?.id ?? makeId(),
    farmerId: profile.id,
    cropId: input.cropId,
    boardId: cropBoardId(input.cropId),
    boardStatus:
      readCachedFarmerWorkspace(profile.id)?.plans.find((plan) => plan.cropId === input.cropId)?.boardStatus ?? 'not-linked',
    transaction: input,
    previousTransaction,
    syncState: isBrowserOnline() ? 'synced' : 'pending',
    createdAt: nowIso(),
  });

  if (!firebaseConfigured) {
    const existing = readDemoTransactions();
    const resolvedTransaction =
      existing.find((transaction) => transaction.farmerId === profile.id && transaction.cropId === input.cropId) ?? null;
    const mergedOptimistic = resolvedTransaction
      ? {
          ...optimistic,
          actualDeliveredVolume: resolvedTransaction.actualDeliveredVolume,
          deliveryStatus: resolvedTransaction.deliveryStatus,
          paymentDueDate: resolvedTransaction.paymentDueDate,
          paymentReference: resolvedTransaction.paymentReference,
          paymentStatus: resolvedTransaction.paymentStatus,
        }
      : optimistic;
    const nextTransactions = existing.some((transaction) => transaction.farmerId === profile.id && transaction.cropId === input.cropId)
      ? existing.map((transaction) =>
          transaction.farmerId === profile.id && transaction.cropId === input.cropId
            ? mergedOptimistic
            : transaction,
        )
      : [mergedOptimistic, ...existing];
    writeDemoTransactions(nextTransactions);
    upsertTransactionInCache(profile.id, mergedOptimistic);
    void syncBoardTransactionToGateway({
      actor: profile,
      transaction: mergedOptimistic,
      action: 'upsert',
    }).catch(() => null);
    return mergedOptimistic;
  }

  upsertTransactionInCache(profile.id, optimistic);

  if (!isBrowserOnline()) {
    queueMutation({
      type: 'transaction-upsert',
      userId: profile.id,
      payload: input,
    });
    return {
      ...optimistic,
      syncState: 'pending',
    };
  }

  try {
    const saved = await saveTransactionRemote(profile, input, previousTransaction);
    upsertTransactionInCache(profile.id, saved);
    void syncBoardTransactionToGateway({
      actor: profile,
      transaction: saved,
      action: 'upsert',
    }).catch(() => null);
    return saved;
  } catch {
    queueMutation({
      type: 'transaction-upsert',
      userId: profile.id,
      payload: input,
    });
    const pendingTransaction = {
      ...optimistic,
      syncState: 'pending' as const,
    };
    upsertTransactionInCache(profile.id, pendingTransaction);
    return pendingTransaction;
  }
}

export async function updateBoardTransactionStatus(
  profile: UserProfile,
  input: BoardTransactionUpdateInput,
) {
  const cachedBoardWorkspace = readCachedBoardWorkspace(profile.id);
  const currentTransaction = cachedBoardWorkspace?.transactions.find(
    (transaction) => transaction.id === input.transactionId,
  );

  if (!currentTransaction) {
    throw new Error('Transaction not found for this board user.');
  }

  const nextTransaction: BoardTransactionRecord = {
    ...currentTransaction,
    actualDeliveredVolume: input.actualDeliveredVolume,
    deliveryStatus: input.deliveryStatus,
    paymentStatus: input.paymentStatus,
    paymentDueDate: input.paymentDueDate || undefined,
    paymentReference: input.paymentReference?.trim() || undefined,
    notes: input.notes.trim(),
    updatedAt: nowIso(),
    syncState: isBrowserOnline() ? 'synced' : 'pending',
  };

  if (!firebaseConfigured) {
    const transactions = readDemoTransactions().map((transaction) =>
      transaction.id === input.transactionId ? nextTransaction : transaction,
    );
    writeDemoTransactions(transactions);
    upsertTransactionInCache(currentTransaction.farmerId, nextTransaction);
    void syncBoardTransactionToGateway({
      actor: profile,
      transaction: nextTransaction,
      action: 'status-update',
    }).catch(() => null);
    return nextTransaction;
  }

  if (!isBrowserOnline()) {
    throw new Error('Reconnect to the internet before updating board transaction status.');
  }

  const row: TransactionRow = {
    id: nextTransaction.id,
    farmer_id: nextTransaction.farmerId,
    crop_id: nextTransaction.cropId,
    board_id: nextTransaction.boardId,
    delivery_point: nextTransaction.deliveryPoint,
    target_delivery_date: nextTransaction.targetDeliveryDate,
    estimated_volume: nextTransaction.estimatedVolume,
    actual_delivered_volume: nextTransaction.actualDeliveredVolume ?? null,
    estimated_gross_usd: nextTransaction.estimatedGrossUsd ?? null,
    estimated_net_usd: nextTransaction.estimatedNetUsd ?? null,
    delivery_status: nextTransaction.deliveryStatus,
    payment_status: nextTransaction.paymentStatus,
    payment_due_date: nextTransaction.paymentDueDate ?? null,
    payment_reference: nextTransaction.paymentReference ?? null,
    notes: nextTransaction.notes,
    created_at: nextTransaction.createdAt,
    updated_at: nextTransaction.updatedAt,
  };

  await writeDocumentRow(transactionsCollection, row);

  const saved = mapTransactionRow(row);
  upsertTransactionInCache(saved.farmerId, saved);
  void syncBoardTransactionToGateway({
    actor: profile,
    transaction: saved,
    action: 'status-update',
  }).catch(() => null);
  return saved;
}

export async function connectBoardIdentity(profile: UserProfile, input: BoardLinkInput) {
  if (!firebaseConfigured) {
    const existing = readDemoPlans();
    const existingPlan = existing.find((plan) => plan.farmerId === profile.id && plan.cropId === input.cropId);
    const verified = resolveVerifiedLink(profile, input.cropId, input.growerId, input.pin);
    const nextPlan = buildOptimisticPlan(
      profile,
      {
        cropId: input.cropId,
        varietyName: existingPlan?.varietyName,
        plantingDate: existingPlan?.plantingDate ?? new Date().toISOString().slice(0, 10),
        totalAreaHa: existingPlan?.totalAreaHa ?? 0,
      },
      {
        growerId: input.growerId.trim(),
        boardStatus: verified ? 'verified' : 'linked',
        verificationSource: verified ? 'registry-pin' : 'manual-link',
      },
    );
    const nextPlans = existing.some((plan) => plan.farmerId === profile.id && plan.cropId === input.cropId)
      ? existing.map((plan) =>
          plan.farmerId === profile.id && plan.cropId === input.cropId ? nextPlan : plan,
        )
      : [nextPlan, ...existing];
    writeDemoPlans(nextPlans);
    upsertPlanInCache(profile.id, nextPlan);
    return nextPlan;
  }

  if (!isBrowserOnline()) {
    const cachedPlan = buildOptimisticPlan(
      profile,
      {
        cropId: input.cropId,
        varietyName: readCachedFarmerWorkspace(profile.id)?.plans.find((plan) => plan.cropId === input.cropId)?.varietyName,
        plantingDate: new Date().toISOString().slice(0, 10),
        totalAreaHa: readCachedFarmerWorkspace(profile.id)?.plans.find((plan) => plan.cropId === input.cropId)?.totalAreaHa ?? 0,
      },
      {
        growerId: input.growerId.trim(),
        boardStatus: 'linked',
        verificationSource: 'offline-link',
        syncState: 'pending',
      },
    );
    queueMutation({
      type: 'plan-link',
      userId: profile.id,
      payload: input,
    });
    upsertPlanInCache(profile.id, cachedPlan);
    return cachedPlan;
  }

  try {
    const linked = await linkPlanRemote(profile, input);
    upsertPlanInCache(profile.id, linked);
    return linked;
  } catch {
    const cachedPlan = buildOptimisticPlan(
      profile,
      {
        cropId: input.cropId,
        plantingDate: new Date().toISOString().slice(0, 10),
        totalAreaHa: readCachedFarmerWorkspace(profile.id)?.plans.find((plan) => plan.cropId === input.cropId)?.totalAreaHa ?? 0,
      },
      {
        growerId: input.growerId.trim(),
        boardStatus: 'linked',
        verificationSource: 'queued-link',
        syncState: 'pending',
      },
    );
    queueMutation({
      type: 'plan-link',
      userId: profile.id,
      payload: input,
    });
    upsertPlanInCache(profile.id, cachedPlan);
    return cachedPlan;
  }
}

async function uploadEnquiryImage(userId: string, file: File) {
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
  const path = `${userId}/${fileName}`;
  await uploadBytes(ref(firebaseStorage!, `${cropEnquiryBucket}/${path}`), file);

  return path;
}

export async function submitCropEnquiry(profile: UserProfile, input: CropEnquiryInput) {
  const localImageUrl = input.imageFile ? await fileToDataUrl(input.imageFile) : undefined;

  if (!firebaseConfigured) {
    const enquiry: CropEnquiryRecord = {
      id: makeId(),
      farmerId: profile.id,
      cropId: input.cropId,
      boardId: cropBoardId(input.cropId),
      issueId: input.issueId,
      note: input.note.trim(),
      imageUrl: localImageUrl,
      createdAt: nowIso(),
      syncState: 'synced',
    };
    writeDemoEnquiries([enquiry, ...readDemoEnquiries()]);
    upsertEnquiryInCache(profile.id, enquiry);
    void syncAgronomistCaseToGateway({
      profile,
      enquiry,
      action: 'enquiry-created',
    }).catch(() => null);
    return enquiry;
  }

  const optimistic = buildOptimisticEnquiry(profile, input, localImageUrl);
  upsertEnquiryInCache(profile.id, optimistic);

  if (!isBrowserOnline()) {
    queueMutation({
      type: 'enquiry-submit',
      userId: profile.id,
      payload: {
        cropId: input.cropId,
        issueId: input.issueId,
        note: input.note.trim(),
        imageDataUrl: localImageUrl,
        imageName: input.imageFile?.name,
      },
    });
    return optimistic;
  }

  try {
    const imagePath = input.imageFile ? await uploadEnquiryImage(profile.id, input.imageFile) : undefined;
    const row: EnquiryRow = {
      id: optimistic.id,
      farmer_id: profile.id,
      crop_id: input.cropId,
      board_id: cropBoardId(input.cropId),
      issue_id: input.issueId,
      note: input.note.trim(),
      image_path: imagePath ?? null,
      created_at: optimistic.createdAt,
    };

    await writeDocumentRow(enquiriesCollection, row, false);

    const saved = mapEnquiryRow(row, imagePath ? await signedUrlForPath(imagePath) : undefined);
    upsertEnquiryInCache(profile.id, saved);
    void syncAgronomistCaseToGateway({
      profile,
      enquiry: saved,
      action: 'enquiry-created',
    }).catch(() => null);
    return saved;
  } catch {
    queueMutation({
      type: 'enquiry-submit',
      userId: profile.id,
      payload: {
        cropId: input.cropId,
        issueId: input.issueId,
        note: input.note.trim(),
        imageDataUrl: localImageUrl,
        imageName: input.imageFile?.name,
      },
    });
    return optimistic;
  }
}

async function applyQueuedMutation(profile: UserProfile, mutation: PendingMutation) {
  switch (mutation.type) {
    case 'profile-update': {
      const payload = mutation.payload as {
        fullName: string;
        farmName?: string;
        country: Country;
        regionId: string;
        soilType?: 'sandy' | 'loam' | 'clay';
        irrigationMethod?: 'drip' | 'sprinkler' | 'pivot' | 'furrow' | 'rainfed';
        locationDetail?: string;
        whatsappNumber?: string;
        specializationIds?: string[];
        availabilityStatus?: 'available' | 'busy' | 'field-visit';
      };
      await writeDocumentRow(userProfilesCollection, {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: payload.fullName,
        farm_name: payload.farmName ?? null,
        country: payload.country,
        region_id: payload.regionId,
        board_id: profile.boardId ?? null,
        soil_type: payload.soilType ?? null,
        irrigation_method: payload.irrigationMethod ?? null,
        location_detail: payload.locationDetail ?? null,
        whatsapp_number: payload.whatsappNumber ?? null,
        specialization_ids: payload.specializationIds ?? [],
        availability_status: payload.availabilityStatus ?? 'available',
        created_at: profile.createdAt,
        updated_at: nowIso(),
      } satisfies ProfileRow);
      return;
    }
    case 'plan-upsert': {
      await savePlanRemote(profile, mutation.payload as CropPlanInput);
      return;
    }
    case 'plan-link': {
      await linkPlanRemote(profile, mutation.payload as BoardLinkInput);
      return;
    }
    case 'planting-record': {
      const payload = mutation.payload as
        | PlantingProgressInput
        | {
            input: PlantingProgressInput;
            targetFarmerId: string;
          };
      if ('input' in payload) {
        await savePlantingRecordRemote(profile, payload.input, payload.targetFarmerId);
      } else {
        await savePlantingRecordRemote(profile, payload);
      }
      return;
    }
    case 'team-invite-create': {
      const payload = mutation.payload as FarmTeamInviteRecord;
      await writeDocumentRow(teamInvitesCollection, {
        id: payload.id,
        farmer_id: payload.farmerId,
        invite_code: payload.inviteCode,
        label: payload.label,
        team_role: payload.teamRole,
        created_at: payload.createdAt,
        claimed_at: payload.claimedAt ?? null,
        is_active: payload.isActive,
      } satisfies TeamInviteRow);
      return;
    }
    case 'transaction-upsert': {
      const currentTransaction = readCachedFarmerWorkspace(profile.id)?.transactions.find(
        (transaction) => transaction.cropId === (mutation.payload as BoardTransactionInput).cropId,
      );
      await saveTransactionRemote(profile, mutation.payload as BoardTransactionInput, currentTransaction);
      return;
    }
    case 'transaction-update': {
      const payload = mutation.payload as BoardTransactionUpdateInput;
      const current = await readDocumentRow<TransactionRow>(transactionsCollection, payload.transactionId);
      if (!current) {
        throw new Error('Unable to find queued transaction update target.');
      }
      await writeDocumentRow(transactionsCollection, {
        ...current,
        actual_delivered_volume: payload.actualDeliveredVolume ?? null,
        delivery_status: payload.deliveryStatus,
        payment_status: payload.paymentStatus,
        payment_due_date: payload.paymentDueDate || null,
        payment_reference: payload.paymentReference?.trim() || null,
        notes: payload.notes.trim(),
        updated_at: nowIso(),
      });
      return;
    }
    case 'enquiry-submit': {
      const payload = mutation.payload as {
        cropId: CropId;
        issueId: string;
        note: string;
        imageDataUrl?: string;
        imageName?: string;
      };
      const file =
        payload.imageDataUrl && payload.imageName
          ? await dataUrlToFile(payload.imageDataUrl, payload.imageName)
          : undefined;
      const imagePath = file ? await uploadEnquiryImage(profile.id, file) : undefined;
      await writeDocumentRow(enquiriesCollection, {
        id: makeId(),
        farmer_id: profile.id,
        crop_id: payload.cropId,
        board_id: cropBoardId(payload.cropId),
        issue_id: payload.issueId,
        note: payload.note,
        image_path: imagePath ?? null,
        created_at: nowIso(),
      } satisfies EnquiryRow, false);
      return;
    }
  }
}

export async function flushPendingSync(profile: UserProfile | null) {
  if (!firebaseConfigured || !profile || !isBrowserOnline()) {
    return getPendingMutations().filter((mutation) => mutation.userId === profile?.id).length;
  }

  const pending = getPendingMutations();
  const remaining: PendingMutation[] = [];

  for (const mutation of pending) {
    if (mutation.userId !== profile.id) {
      remaining.push(mutation);
      continue;
    }

    try {
      await applyQueuedMutation(profile, mutation);
      clearPendingMutation(mutation.id);
    } catch {
      remaining.push(mutation);
      break;
    }
  }

  if (remaining.length !== pending.length) {
    const untouched = pending.filter(
      (mutation) => mutation.userId !== profile.id && !remaining.some((item) => item.id === mutation.id),
    );
    replacePendingMutations([...untouched, ...remaining]);
  }

  return getPendingMutations().filter((mutation) => mutation.userId === profile.id).length;
}

export function subscribeToAuthChanges(callback: () => void) {
  if (!firebaseConfigured || !firebaseAuth) {
    return () => undefined;
  }

  return onAuthStateChanged(firebaseAuth, () => {
    callback();
  });
}

export const saveUserProfile = saveFarmerProfile;
