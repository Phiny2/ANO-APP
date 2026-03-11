import { Suspense, lazy, useEffect, useState } from 'react';
import HeroBanner from './components/HeroBanner';
import PreferencesBar from './components/PreferencesBar';
import type {
  AgronomistWorkspace as AgronomistWorkspaceData,
  AuthState,
  BoardLinkInput,
  FarmTeamInviteInput,
  BoardTransactionUpdateInput,
  BoardTransactionInput,
  BoardWorkspace as BoardWorkspaceData,
  CropEnquiryInput,
  CropPlanInput,
  FarmerWorkspace as FarmerWorkspaceData,
  PlantingProgressInput,
  SignUpAgronomistInput,
  SignUpStaffInput,
  SignInInput,
  SignUpFarmerInput,
  StaffWorkspace as StaffWorkspaceData,
  UserProfile,
} from './lib/app-types';
import { applyPreferencesToDocument, readPreferences, savePreferences } from './lib/preferences';
import {
  connectBoardIdentity,
  createFarmTeamInvite,
  flushPendingSync,
  getAuthState,
  loadAgronomistWorkspace,
  loadBoardWorkspace,
  loadFarmerWorkspace,
  loadStaffWorkspace,
  recordPlantingProgress,
  signUpAgronomist,
  signUpStaff,
  saveBoardTransaction,
  saveCropPlan,
  saveFarmerProfile,
  signIn,
  signOut,
  signUpFarmer,
  submitCropEnquiry,
  subscribeToAuthChanges,
  updateBoardTransactionStatus,
} from './lib/repository';

const AdminWorkspace = lazy(() => import('./components/AdminWorkspace'));
const AgronomistWorkspace = lazy(() => import('./components/AgronomistWorkspace'));
const AuthPanel = lazy(() => import('./components/AuthPanel'));
const BoardWorkspace = lazy(() => import('./components/BoardWorkspace'));
const FarmerWorkspace = lazy(() => import('./components/FarmerWorkspaceNext'));
const StaffWorkspace = lazy(() => import('./components/StaffWorkspace'));

function WorkspaceLoadingCard() {
  return (
    <section className="card toolbar-card">
      <div className="section-header">
        <div>
          <p className="section-kicker">Loading</p>
          <h2>Preparing your workspace</h2>
        </div>
        <span className="badge accent">Please wait</span>
      </div>
      <p className="muted">Loading the next app section and preparing data for this role.</p>
    </section>
  );
}

function App() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [farmerWorkspace, setFarmerWorkspace] = useState<FarmerWorkspaceData | null>(null);
  const [boardWorkspace, setBoardWorkspace] = useState<BoardWorkspaceData | null>(null);
  const [agronomistWorkspace, setAgronomistWorkspace] = useState<AgronomistWorkspaceData | null>(null);
  const [staffWorkspace, setStaffWorkspace] = useState<StaffWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [preferences, setPreferences] = useState(readPreferences);

  async function refreshAuth() {
    setLoading(true);
    try {
      const nextAuth = await getAuthState();
      setAuthState(nextAuth);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to initialize the app.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshWorkspace(profile: UserProfile) {
    if (profile.role === 'farmer') {
      const workspace = await loadFarmerWorkspace(profile);
      setFarmerWorkspace(workspace);
      setBoardWorkspace(null);
      setAgronomistWorkspace(null);
      setStaffWorkspace(null);
      return;
    }

    if (profile.role === 'board') {
      const workspace = await loadBoardWorkspace(profile);
      setBoardWorkspace(workspace);
      setFarmerWorkspace(null);
      setAgronomistWorkspace(null);
      setStaffWorkspace(null);
      return;
    }

    if (profile.role === 'agronomist') {
      const workspace = await loadAgronomistWorkspace(profile);
      setAgronomistWorkspace(workspace);
      setFarmerWorkspace(null);
      setBoardWorkspace(null);
      setStaffWorkspace(null);
      return;
    }

    if (profile.role === 'admin') {
      setFarmerWorkspace(null);
      setBoardWorkspace(null);
      setAgronomistWorkspace(null);
      setStaffWorkspace(null);
      return;
    }

    const workspace = await loadStaffWorkspace(profile);
    setStaffWorkspace(workspace);
    setFarmerWorkspace(null);
    setBoardWorkspace(null);
    setAgronomistWorkspace(null);
  }

  useEffect(() => {
    void refreshAuth();
    const unsubscribe = subscribeToAuthChanges(() => {
      void refreshAuth();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authState?.profile) {
      setFarmerWorkspace(null);
      setBoardWorkspace(null);
      setAgronomistWorkspace(null);
      setStaffWorkspace(null);
      return;
    }

    void refreshWorkspace(authState.profile).catch((error) => {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to load the dashboard right now.',
      );
    });
  }, [authState?.profile?.id, authState?.profile?.role, authState?.profile?.updatedAt]);

  useEffect(() => {
    applyPreferencesToDocument(preferences);
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!authState?.profile) {
      return;
    }

    const handleOnline = () => {
      void handleSyncNow(authState.profile!);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [authState?.profile]);

  async function handleSignUp(input: SignUpFarmerInput) {
    setBusy(true);
    setStatusMessage('');
    try {
      const result = await signUpFarmer(input);
      await refreshAuth();
      return {
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      };
    } finally {
      setBusy(false);
    }
  }

  async function handleAgronomistSignUp(input: SignUpAgronomistInput) {
    setBusy(true);
    setStatusMessage('');
    try {
      const result = await signUpAgronomist(input);
      await refreshAuth();
      return {
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      };
    } finally {
      setBusy(false);
    }
  }

  async function handleStaffSignUp(input: SignUpStaffInput) {
    setBusy(true);
    setStatusMessage('');
    try {
      const result = await signUpStaff(input);
      await refreshAuth();
      return {
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      };
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(input: SignInInput) {
    setBusy(true);
    setStatusMessage('');
    try {
      await signIn(input);
      await refreshAuth();
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setStatusMessage('');
      await refreshAuth();
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow(profile: UserProfile) {
    setSyncing(true);
    try {
      const pending = await flushPendingSync(profile);
      setStatusMessage(
        pending
          ? `${pending} action(s) are still waiting for network or backend confirmation.`
          : 'All pending actions are synced.',
      );
      await refreshWorkspace(profile);
    } finally {
      setSyncing(false);
    }
  }

  async function handleProfileSave(profile: UserProfile, updates: Partial<UserProfile>) {
    setBusy(true);
    try {
      const nextProfile = await saveFarmerProfile(profile, updates);
      setAuthState((current) =>
        current ? { ...current, profile: nextProfile } : current,
      );
      setStatusMessage('Farmer profile saved.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTeamInviteCreate(profile: UserProfile, input: FarmTeamInviteInput) {
    setBusy(true);
    try {
      await createFarmTeamInvite(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Farm team invite created.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanSave(profile: UserProfile, input: CropPlanInput) {
    setBusy(true);
    try {
      await saveCropPlan(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Crop plan saved.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBoardLink(profile: UserProfile, input: BoardLinkInput) {
    setBusy(true);
    try {
      await connectBoardIdentity(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Board verification request saved.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePlantingRecord(profile: UserProfile, input: PlantingProgressInput) {
    setBusy(true);
    try {
      await recordPlantingProgress(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Planting progress saved.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTransactionSave(profile: UserProfile, input: BoardTransactionInput) {
    setBusy(true);
    try {
      await saveBoardTransaction(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Board delivery booking saved.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBoardTransactionUpdate(
    profile: UserProfile,
    input: BoardTransactionUpdateInput,
  ) {
    setBusy(true);
    try {
      await updateBoardTransactionStatus(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Board transaction status updated.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEnquirySave(profile: UserProfile, input: CropEnquiryInput) {
    setBusy(true);
    try {
      await submitCropEnquiry(profile, input);
      await refreshWorkspace(profile);
      setStatusMessage('Crop enquiry saved.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !authState) {
    return (
      <div className="app-shell">
        <HeroBanner
          backend={{
            configured: false,
            mode: 'demo',
            detail: 'Loading application state...',
          }}
          preferences={preferences}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<WorkspaceLoadingCard />}>
        {!authState.profile ? (
          <>
            <HeroBanner backend={authState.backend} preferences={preferences} />
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
            <AuthPanel
              backend={authState.backend}
              busy={busy}
              message={statusMessage}
              onSignIn={handleSignIn}
              onSignUpAgronomist={handleAgronomistSignUp}
              onSignUp={handleSignUp}
              onSignUpStaff={handleStaffSignUp}
              preferences={preferences}
            />
          </>
        ) : authState.profile.role === 'farmer' && farmerWorkspace ? (
          <>
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
            <FarmerWorkspace
              backend={authState.backend}
              busy={busy}
              onLinkBoard={handleBoardLink}
              onSavePlan={handlePlanSave}
              onSavePlantingRecord={handlePlantingRecord}
              onSaveProfile={handleProfileSave}
              onSaveTeamInvite={handleTeamInviteCreate}
              onSaveTransaction={handleTransactionSave}
              onSignOut={handleSignOut}
              onSubmitEnquiry={handleEnquirySave}
              onSyncNow={handleSyncNow}
              preferences={preferences}
              statusMessage={statusMessage}
              syncing={syncing}
              workspace={farmerWorkspace}
            />
          </>
        ) : authState.profile.role === 'board' && boardWorkspace ? (
          <>
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
            <BoardWorkspace
              backend={authState.backend}
              busy={busy}
              onRefresh={() => refreshWorkspace(authState.profile!)}
              onSignOut={handleSignOut}
              onUpdateTransaction={(input) => handleBoardTransactionUpdate(authState.profile!, input)}
              statusMessage={statusMessage}
              workspace={boardWorkspace}
            />
          </>
        ) : authState.profile.role === 'agronomist' && agronomistWorkspace ? (
          <>
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
            <AgronomistWorkspace
              backend={authState.backend}
              busy={busy}
              onRefresh={() => refreshWorkspace(authState.profile!)}
              onSaveProfile={handleProfileSave}
              onSignOut={handleSignOut}
              statusMessage={statusMessage}
              workspace={agronomistWorkspace}
            />
          </>
        ) : authState.profile.role === 'staff' && staffWorkspace ? (
          <>
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
            <StaffWorkspace
              backend={authState.backend}
              busy={busy}
              onRefresh={() => refreshWorkspace(authState.profile!)}
              onSavePlantingRecord={handlePlantingRecord}
              onSignOut={handleSignOut}
              statusMessage={statusMessage}
              workspace={staffWorkspace}
            />
          </>
        ) : authState.profile.role === 'admin' ? (
          <>
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
            <AdminWorkspace
              backend={authState.backend}
              onRefresh={refreshAuth}
              onSignOut={handleSignOut}
              profile={authState.profile}
              statusMessage={statusMessage}
            />
          </>
        ) : (
          <>
            <HeroBanner backend={authState.backend} preferences={preferences} />
            <PreferencesBar preferences={preferences} onChange={setPreferences} />
          </>
        )}
      </Suspense>
    </div>
  );
}

export default App;
