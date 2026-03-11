import { useMemo, useState } from 'react';
import { boards, crops } from '../data';
import type { BackendStatus, BoardIntegrationRecord, MobileReleaseItem, UserProfile } from '../lib/app-types';
import { cacheGet } from '../lib/cache';
import {
  getMobileReleaseChecklist,
  getOperationsSnapshot,
  updateBoardIntegration,
  updateMobileReleaseItem,
} from '../lib/operations';
import { supplierOffers } from '../lib/platform-catalog';
import { formatDate } from '../lib/weather';

interface AdminWorkspaceProps {
  backend: BackendStatus;
  profile: UserProfile;
  statusMessage: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

function AdminWorkspace({
  backend,
  profile,
  statusMessage,
  onRefresh,
  onSignOut,
}: AdminWorkspaceProps) {
  const [refreshTick, setRefreshTick] = useState(0);

  const demoUsers = cacheGet<Array<UserProfile & Record<string, unknown>>>('ano-demo-users', []);
  const demoPlans = cacheGet<Array<Record<string, unknown>>>('ano-demo-plans', []);
  const snapshot = useMemo(() => getOperationsSnapshot(), [refreshTick]);
  const mobileRelease = useMemo(() => getMobileReleaseChecklist(), [refreshTick]);
  const countsByRole = demoUsers.reduce<Record<string, number>>((accumulator, user) => {
    accumulator[user.role] = (accumulator[user.role] ?? 0) + 1;
    return accumulator;
  }, {});

  function refreshLocal() {
    setRefreshTick((current) => current + 1);
  }

  function handleIntegrationStatusChange(record: BoardIntegrationRecord, status: BoardIntegrationRecord['status']) {
    updateBoardIntegration({
      id: record.id,
      status,
      summary: record.summary,
    });
    refreshLocal();
  }

  function handleReleaseStatusChange(item: MobileReleaseItem, status: MobileReleaseItem['status']) {
    updateMobileReleaseItem({
      id: item.id,
      status,
    });
    refreshLocal();
  }

  return (
    <main className="dashboard-grid admin-mode">
      <section className="card toolbar-card">
        <div className="toolbar-row">
          <div>
            <p className="section-kicker">Admin workspace</p>
            <h2>{profile.fullName}</h2>
            <p className="muted">{profile.email}</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
              Refresh auth
            </button>
            <button className="secondary-button" type="button" onClick={refreshLocal}>
              Refresh admin metrics
            </button>
            <button className="secondary-button" type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="sync-strip">
          <span className={`sync-badge ${backend.mode}`}>{backend.mode === 'online' ? 'Online backend' : 'Demo backend'}</span>
          <span>{backend.detail}</span>
        </div>
        {statusMessage ? <p className="muted">{statusMessage}</p> : null}
      </section>

      <section className="card board-overview-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Platform pulse</p>
            <h2>National operations overview</h2>
          </div>
          <span className="badge accent">Admin</span>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <span>Farmers</span>
            <strong>{countsByRole.farmer ?? 0}</strong>
          </div>
          <div className="metric-card">
            <span>Agronomists</span>
            <strong>{countsByRole.agronomist ?? 0}</strong>
          </div>
          <div className="metric-card">
            <span>Staff / boards / admin</span>
            <strong>{(countsByRole.staff ?? 0) + (countsByRole.board ?? 0) + (countsByRole.admin ?? 0)}</strong>
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric-card compact-metric">
            <span>Saved crop plans</span>
            <strong>{demoPlans.length}</strong>
          </div>
          <div className="metric-card compact-metric">
            <span>Agronomist cases</span>
            <strong>{snapshot.cases.length}</strong>
          </div>
          <div className="metric-card compact-metric">
            <span>Orders / payments / harvests</span>
            <strong>{snapshot.orders.length + snapshot.payments.length + snapshot.harvests.length}</strong>
          </div>
        </div>
      </section>

      <section className="card advisory-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Integrations</p>
            <h2>Push, AI, boards, and payments</h2>
          </div>
          <span className="badge">{snapshot.integrations.length} tracked</span>
        </div>
        <div className="service-grid">
          {snapshot.integrations.map((record) => (
            <article className="service-card" key={record.id}>
              <span className={`badge ${record.status === 'connected' ? 'success' : record.status === 'warning' ? 'warning' : 'neutral'}`}>
                {record.status}
              </span>
              <strong>{record.label}</strong>
              <p>{record.summary}</p>
              {record.provider ? <small>{record.provider}</small> : null}
              {record.mode ? <small>{record.mode === 'live' ? 'Live mode' : record.mode === 'hybrid' ? 'Hybrid mode' : 'Demo mode'}</small> : null}
              {record.configured !== undefined ? (
                <small>{record.configured ? 'Provider configuration detected' : 'Running with fallback configuration'}</small>
              ) : null}
              {record.boardId ? <small>{boards.find((board) => board.id === record.boardId)?.name ?? record.boardId}</small> : null}
              {record.requirements?.length ? <small>Needs: {record.requirements.join(', ')}</small> : null}
              {record.lastSyncAt ? <small>Last update {formatDate(record.lastSyncAt.slice(0, 10))}</small> : null}
              <select
                value={record.status}
                onChange={(event) => handleIntegrationStatusChange(record, event.target.value as BoardIntegrationRecord['status'])}
              >
                <option value="connected">Connected</option>
                <option value="warning">Warning</option>
                <option value="planned">Planned</option>
                <option value="offline">Offline</option>
              </select>
            </article>
          ))}
        </div>
        <div className="notice-callout top-gap">
          <strong>Live integration note</strong>
          <span>The dashboard now reads live environment configuration as well as app-side status, so admins can immediately see which providers are truly connected and which features are still running on rollout-safe fallback mode.</span>
        </div>
      </section>

      <section className="card weather-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Marketplace</p>
            <h2>Supplier catalogue</h2>
          </div>
          <span className="badge accent">{supplierOffers.length} offers</span>
        </div>
        <div className="service-grid">
          {supplierOffers.map((offer) => (
            <article className="service-card" key={offer.id}>
              <span className="service-kind">{offer.category}</span>
              <strong>{offer.productName}</strong>
              <p>{offer.supplierName}</p>
              <small>{crops.find((crop) => crop.id === offer.cropId)?.name ?? offer.cropId}</small>
              <small>{offer.unitPriceUsd > 0 ? `${offer.unitPriceUsd.toFixed(2)} USD | ${offer.unitLabel}` : 'Quote item'}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="card account-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Mobile release</p>
            <h2>Store-readiness checklist</h2>
          </div>
          <span className="badge accent">{mobileRelease.length} items</span>
        </div>
        <div className="service-grid">
          {mobileRelease.map((item) => (
            <article className="service-card" key={item.id}>
              <span className={`badge ${item.status === 'ready' ? 'success' : item.status === 'in-progress' ? 'warning' : 'neutral'}`}>
                {item.status}
              </span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <select
                value={item.status}
                onChange={(event) => handleReleaseStatusChange(item, event.target.value as MobileReleaseItem['status'])}
              >
                <option value="ready">Ready</option>
                <option value="in-progress">In progress</option>
                <option value="pending">Pending</option>
              </select>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default AdminWorkspace;
