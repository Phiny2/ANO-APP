import { useEffect, useState } from 'react';
import { crops, regions } from '../data';
import type {
  BackendStatus,
  BoardTransactionUpdateInput,
  BoardWorkspace as BoardWorkspaceData,
} from '../lib/app-types';
import { formatMarketValue, getBoardMarketReferences } from '../lib/enterprise';
import { formatUsd } from '../lib/economics';
import { getBoardIntegrations } from '../lib/operations';
import { formatDate } from '../lib/weather';

interface BoardWorkspaceProps {
  backend: BackendStatus;
  busy: boolean;
  workspace: BoardWorkspaceData;
  statusMessage: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateTransaction: (input: BoardTransactionUpdateInput) => Promise<void>;
}

function BoardWorkspace({
  backend,
  busy,
  workspace,
  statusMessage,
  onRefresh,
  onSignOut,
  onUpdateTransaction,
}: BoardWorkspaceProps) {
  const verifiedCount = workspace.growers.filter((grower) => grower.boardStatus === 'verified').length;
  const pendingCount = workspace.growers.filter((grower) => grower.boardStatus === 'linked').length;
  const byRegion = workspace.growers.reduce<Record<string, number>>((accumulator, grower) => {
    const regionName = regions.find((region) => region.id === grower.regionId)?.name ?? grower.regionId;
    accumulator[regionName] = (accumulator[regionName] ?? 0) + 1;
    return accumulator;
  }, {});
  const marketReferences = workspace.profile.boardId ? getBoardMarketReferences(workspace.profile.boardId) : [];
  const integrationRecords = getBoardIntegrations(workspace.profile.boardId);
  const [transactionDrafts, setTransactionDrafts] = useState<
    Record<
      string,
      {
        actualDeliveredVolume: string;
        deliveryStatus: 'not-booked' | 'booked' | 'delivered' | 'cleared';
        paymentStatus: 'not-raised' | 'awaiting-board' | 'approved' | 'paid';
        paymentDueDate: string;
        paymentReference: string;
        notes: string;
      }
    >
  >({});

  useEffect(() => {
    setTransactionDrafts(
      workspace.transactions.reduce<Record<string, {
        actualDeliveredVolume: string;
        deliveryStatus: 'not-booked' | 'booked' | 'delivered' | 'cleared';
        paymentStatus: 'not-raised' | 'awaiting-board' | 'approved' | 'paid';
        paymentDueDate: string;
        paymentReference: string;
        notes: string;
      }>>((accumulator, transaction) => {
        accumulator[transaction.id] = {
          actualDeliveredVolume:
            transaction.actualDeliveredVolume === undefined ? '' : String(transaction.actualDeliveredVolume),
          deliveryStatus: transaction.deliveryStatus,
          paymentStatus: transaction.paymentStatus,
          paymentDueDate: transaction.paymentDueDate ?? '',
          paymentReference: transaction.paymentReference ?? '',
          notes: transaction.notes,
        };
        return accumulator;
      }, {}),
    );
  }, [workspace.transactions]);

  return (
    <main className="dashboard-grid board-mode">
      <section className="card toolbar-card">
        <div className="toolbar-row">
          <div>
            <p className="section-kicker">Marketing board</p>
            <h2>{workspace.profile.fullName}</h2>
            <p className="muted">{workspace.profile.email}</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
              Refresh
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
            <p className="section-kicker">Overview</p>
            <h2>Grower pipeline</h2>
          </div>
          {workspace.profile.boardId ? <span className="badge accent">{workspace.profile.boardId}</span> : null}
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <span>Verified growers</span>
            <strong>{verifiedCount}</strong>
          </div>
          <div className="metric-card">
            <span>Pending linked growers</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="metric-card">
            <span>Total grower plans</span>
            <strong>{workspace.growers.length}</strong>
          </div>
        </div>

        <div className="split-grid">
          <article className="subcard">
            <h3>Region distribution</h3>
            {Object.keys(byRegion).length ? (
              <ul className="stack-list">
                {Object.entries(byRegion).map(([regionName, total]) => (
                  <li key={regionName}>
                    <strong>{regionName}</strong>
                    <span>{total} growers</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No growers have linked to this board yet.</p>
            )}
          </article>

          <article className="subcard">
            <h3>Grower records</h3>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th>Region</th>
                    <th>Crop</th>
                    <th>Area</th>
                    <th>Planting</th>
                    <th>Status</th>
                    <th>Grower ID</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.growers.map((grower) => (
                    <tr key={`${grower.farmerId}-${grower.cropId}`}>
                      <td>
                        <strong>{grower.fullName}</strong>
                        <div className="table-subtext">{grower.email}</div>
                      </td>
                      <td>{regions.find((region) => region.id === grower.regionId)?.name ?? grower.regionId}</td>
                      <td>{crops.find((crop) => crop.id === grower.cropId)?.name ?? grower.cropId}</td>
                      <td>{grower.totalAreaHa.toFixed(1)} ha</td>
                      <td>{formatDate(grower.plantingDate)}</td>
                      <td className={grower.boardStatus === 'verified' ? 'status-good' : 'status-warn'}>
                        {grower.boardStatus}
                      </td>
                      <td>{grower.growerId ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <article className="subcard top-gap">
          <h3>Market signals</h3>
          {marketReferences.length ? (
            <div className="service-grid">
              {marketReferences.map((market) => (
                <article className="service-card" key={market.cropId}>
                  <span className="service-kind">{crops.find((crop) => crop.id === market.cropId)?.name ?? market.cropId}</span>
                  <strong>{formatMarketValue(market.priceUsd, market.unit)}</strong>
                  <p>{market.note}</p>
                  <a className="inline-link" href={market.source.url} rel="noreferrer" target="_blank">
                    {market.source.vendor}
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No board market references are loaded yet.</p>
          )}
        </article>

        <article className="subcard top-gap">
          <h3>Integration center</h3>
          {integrationRecords.length ? (
            <div className="service-grid">
              {integrationRecords.map((record) => (
                <article className="service-card" key={record.id}>
                  <span className={`badge ${record.status === 'connected' ? 'success' : record.status === 'warning' ? 'warning' : 'neutral'}`}>
                    {record.status}
                  </span>
                  <strong>{record.label}</strong>
                  <p>{record.summary}</p>
                  {record.provider ? <small>{record.provider}</small> : null}
                  {record.mode ? <small>{record.mode === 'live' ? 'Live mode' : record.mode === 'hybrid' ? 'Hybrid mode' : 'Demo mode'}</small> : null}
                  {record.requirements?.length ? <small>Needs: {record.requirements.join(', ')}</small> : null}
                  {record.lastSyncAt ? <small>Last update {formatDate(record.lastSyncAt.slice(0, 10))}</small> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No integration health records are loaded for this board.</p>
          )}
        </article>

        <article className="subcard top-gap">
          <h3>Delivery bookings and payments</h3>
          {workspace.transactions.length ? (
            <div className="service-grid">
              {workspace.transactions.map((transaction) => {
                const grower = workspace.growers.find((entry) => entry.farmerId === transaction.farmerId);
                const draft = transactionDrafts[transaction.id];
                return (
                  <article className="service-card transaction-admin-card" key={transaction.id}>
                    <span className="service-kind">
                      {crops.find((crop) => crop.id === transaction.cropId)?.name ?? transaction.cropId}
                    </span>
                    <strong>{grower?.fullName ?? 'Grower record'}</strong>
                    <p>
                      {transaction.deliveryPoint} | {formatDate(transaction.targetDeliveryDate)}
                    </p>
                    <small>
                      Planned volume {transaction.estimatedVolume.toFixed(transaction.cropId === 'tobacco' ? 0 : 2)}
                    </small>
                    <div className="form-grid compact">
                      <label>
                        Delivery status
                        <select
                          value={draft?.deliveryStatus ?? transaction.deliveryStatus}
                          onChange={(event) =>
                            setTransactionDrafts((current) => ({
                              ...current,
                              [transaction.id]: {
                                ...current[transaction.id],
                                deliveryStatus: event.target.value as typeof transaction.deliveryStatus,
                              },
                            }))
                          }
                        >
                          <option value="not-booked">Not booked</option>
                          <option value="booked">Booked</option>
                          <option value="delivered">Delivered</option>
                          <option value="cleared">Cleared</option>
                        </select>
                      </label>
                      <label>
                        Payment status
                        <select
                          value={draft?.paymentStatus ?? transaction.paymentStatus}
                          onChange={(event) =>
                            setTransactionDrafts((current) => ({
                              ...current,
                              [transaction.id]: {
                                ...current[transaction.id],
                                paymentStatus: event.target.value as typeof transaction.paymentStatus,
                              },
                            }))
                          }
                        >
                          <option value="not-raised">Not raised</option>
                          <option value="awaiting-board">Awaiting board</option>
                          <option value="approved">Approved</option>
                          <option value="paid">Paid</option>
                        </select>
                      </label>
                      <label>
                        Delivered volume
                        <input
                          min="0"
                          step={transaction.cropId === 'tobacco' ? '1' : '0.1'}
                          type="number"
                          value={draft?.actualDeliveredVolume ?? ''}
                          onChange={(event) =>
                            setTransactionDrafts((current) => ({
                              ...current,
                              [transaction.id]: {
                                ...current[transaction.id],
                                actualDeliveredVolume: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Payment due date
                        <input
                          type="date"
                          value={draft?.paymentDueDate ?? ''}
                          onChange={(event) =>
                            setTransactionDrafts((current) => ({
                              ...current,
                              [transaction.id]: {
                                ...current[transaction.id],
                                paymentDueDate: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Payment reference
                        <input
                          type="text"
                          value={draft?.paymentReference ?? ''}
                          onChange={(event) =>
                            setTransactionDrafts((current) => ({
                              ...current,
                              [transaction.id]: {
                                ...current[transaction.id],
                                paymentReference: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          type="text"
                          value={draft?.notes ?? transaction.notes}
                          onChange={(event) =>
                            setTransactionDrafts((current) => ({
                              ...current,
                              [transaction.id]: {
                                ...current[transaction.id],
                                notes: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="action-row">
                      <span className="muted">
                        {transaction.estimatedNetUsd !== undefined ? formatUsd(transaction.estimatedNetUsd) : 'No net estimate'}
                      </span>
                      <button
                        className="secondary-button"
                        disabled={busy || !draft}
                        type="button"
                        onClick={() =>
                          void onUpdateTransaction({
                            transactionId: transaction.id,
                            actualDeliveredVolume: draft.actualDeliveredVolume ? Number(draft.actualDeliveredVolume) : undefined,
                            deliveryStatus: draft.deliveryStatus,
                            paymentStatus: draft.paymentStatus,
                            paymentDueDate: draft.paymentDueDate || undefined,
                            paymentReference: draft.paymentReference,
                            notes: draft.notes,
                          })
                        }
                      >
                        Save status
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">No farmers have created board transaction bookings yet.</p>
          )}
        </article>

        <article className="subcard top-gap">
          <h3>Recent crop enquiries</h3>
          {workspace.enquiries.length ? (
            <div className="enquiry-grid">
              {workspace.enquiries.slice(0, 6).map((enquiry) => (
                <article className="subcard compact" key={enquiry.id}>
                  <strong>{crops.find((crop) => crop.id === enquiry.cropId)?.name}</strong>
                  <span className="muted">{formatDate(enquiry.createdAt.slice(0, 10))}</span>
                  <p>{enquiry.note}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No enquiries have been submitted to this board yet.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default BoardWorkspace;
