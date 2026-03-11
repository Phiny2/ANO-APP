import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { boards, crops, regions, type CropIssue } from '../data';
import type { BoardStatus, BoardTransactionInput, BoardTransactionRecord } from '../lib/app-types';
import type { CropDiagnosisResult } from '../lib/diagnosis';
import {
  buildBoardWorkflow,
  buildEscalationGuide,
  buildProfitabilitySummary,
  buildSupportLinks,
  formatMarketValue,
  formatOutput,
  formatScenarioLabel,
} from '../lib/enterprise';
import { formatUsd } from '../lib/economics';
import {
  buildSuggestedTransactionProjection,
  describeTransactionStatus,
  getDeliveryChecklist,
  getDeliveryPointOptions,
  getDeliveryStatusTone,
  getPaymentStatusTone,
  getVolumeUnit,
} from '../lib/transactions';
import { formatDate, getLocalIsoDate } from '../lib/weather';

interface FarmBusinessDeskProps {
  cropId: string;
  regionId: string;
  totalAreaHa: number;
  knownInputCostUsd: number;
  boardStatus: BoardStatus;
  issue: CropIssue | null;
  enquiryNote: string;
  diagnosis: CropDiagnosisResult | null;
  transaction: BoardTransactionRecord | null;
  busy: boolean;
  onSaveTransaction: (input: BoardTransactionInput) => Promise<void>;
}

function FarmBusinessDesk({
  cropId,
  regionId,
  totalAreaHa,
  knownInputCostUsd,
  boardStatus,
  issue,
  enquiryNote,
  diagnosis,
  transaction,
  busy,
  onSaveTransaction,
}: FarmBusinessDeskProps) {
  const crop = crops.find((entry) => entry.id === cropId);
  if (!crop) {
    return null;
  }
  const selectedCrop = crop;

  const regionName = regions.find((region) => region.id === regionId)?.name ?? regionId;
  const boardName = boards.find((board) => board.id === crop.boardId)?.name ?? crop.boardId;
  const profitability = buildProfitabilitySummary({
    cropId: selectedCrop.id,
    regionId,
    totalAreaHa,
    knownInputCostUsd,
    boardStatus,
  });
  const workflow = buildBoardWorkflow(selectedCrop.id, boardStatus, regionId);
  const supportLinks = buildSupportLinks(selectedCrop.id, regionId);
  const escalation = buildEscalationGuide({
    cropId: selectedCrop.id,
    regionId,
    issue,
    note: enquiryNote,
    diagnosis,
  });
  const targetScenario = profitability.scenarios.find((scenario) => scenario.label === 'Target') ?? profitability.scenarios[0];
  const deliveryOptions = getDeliveryPointOptions(selectedCrop.id, regionId);
  const checklist = getDeliveryChecklist(selectedCrop.id);
  const projection = buildSuggestedTransactionProjection({
    cropId: selectedCrop.id,
    totalAreaHa,
    targetYieldPerHa: targetScenario.yieldPerHa,
    targetGrossUsd: targetScenario.grossRevenueUsd,
    targetNetUsd: targetScenario.netMarginUsd,
  });
  const [transactionForm, setTransactionForm] = useState({
    deliveryPoint: transaction?.deliveryPoint ?? deliveryOptions[0]?.name ?? '',
    targetDeliveryDate: transaction?.targetDeliveryDate ?? getLocalIsoDate(),
    estimatedVolume:
      transaction?.estimatedVolume
        ? String(transaction.estimatedVolume)
        : String(projection.suggestedVolume || ''),
    notes: transaction?.notes ?? '',
  });
  const [transactionError, setTransactionError] = useState('');

  useEffect(() => {
    setTransactionForm({
      deliveryPoint: transaction?.deliveryPoint ?? deliveryOptions[0]?.name ?? '',
      targetDeliveryDate: transaction?.targetDeliveryDate ?? getLocalIsoDate(),
      estimatedVolume:
        transaction?.estimatedVolume
          ? String(transaction.estimatedVolume)
          : String(projection.suggestedVolume || ''),
      notes: transaction?.notes ?? '',
    });
  }, [deliveryOptions, projection.suggestedVolume, transaction?.deliveryPoint, transaction?.estimatedVolume, transaction?.notes, transaction?.targetDeliveryDate]);

  const transactionSummary = useMemo(
    () => (transaction ? describeTransactionStatus(transaction) : 'Book a delivery point and target date so the board workflow becomes actionable.'),
    [transaction],
  );

  async function handleTransactionSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const estimatedVolume = Number(transactionForm.estimatedVolume);

    if (!transactionForm.deliveryPoint) {
      setTransactionError('Choose a delivery point before saving the booking.');
      return;
    }

    if (!Number.isFinite(estimatedVolume) || estimatedVolume <= 0) {
      setTransactionError(`Enter the expected ${getVolumeUnit(selectedCrop.id)} you plan to deliver.`);
      return;
    }

    setTransactionError('');
    await onSaveTransaction({
      cropId: selectedCrop.id,
      deliveryPoint: transactionForm.deliveryPoint,
      targetDeliveryDate: transactionForm.targetDeliveryDate,
      estimatedVolume,
      estimatedGrossUsd: targetScenario.grossRevenueUsd ?? undefined,
      estimatedNetUsd: targetScenario.netMarginUsd ?? undefined,
      notes: transactionForm.notes,
    });
  }

  return (
    <>
      <article className="subcard">
        <div className="section-header compact-header">
          <div>
            <h3>Profitability dashboard</h3>
            <p className="muted">Turn the crop plan into a margin estimate for {regionName}.</p>
          </div>
          <span className="badge accent">{formatMarketValue(profitability.market.priceUsd, profitability.market.unit)}</span>
        </div>
        <div className="metric-grid business-metric-grid">
          <div className="metric-card">
            <span>Input + operating cost</span>
            <strong>{formatUsd(profitability.totalCostUsd)}</strong>
            <small>{formatUsd(profitability.operatingCostUsd)} operating</small>
          </div>
          <div className="metric-card">
            <span>Break-even yield</span>
            <strong>
              {profitability.breakEvenYieldPerHa === null
                ? 'Quote first'
                : `${profitability.breakEvenYieldPerHa.toFixed(profitability.market.unit === 'kg' ? 0 : 2)} ${profitability.market.unit}/ha`}
            </strong>
            <small>{selectedCrop.name}</small>
          </div>
          <div className="metric-card">
            <span>Target margin</span>
            <strong>{targetScenario.netMarginUsd === null ? 'Quote first' : formatUsd(targetScenario.netMarginUsd)}</strong>
            <small>{targetScenario.grossRevenueUsd === null ? 'Contract crop' : formatUsd(targetScenario.grossRevenueUsd)} revenue</small>
          </div>
        </div>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Yield</th>
                <th>Output</th>
                <th>Revenue</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {profitability.scenarios.map((scenario) => (
                <tr key={scenario.label}>
                  <td>{formatScenarioLabel(scenario.label)}</td>
                  <td>{scenario.yieldPerHa.toFixed(profitability.market.unit === 'kg' ? 0 : 2)} {profitability.market.unit}/ha</td>
                  <td>{formatOutput(scenario.totalOutput, scenario.unit)}</td>
                  <td>{scenario.grossRevenueUsd === null ? 'Contract quote' : formatUsd(scenario.grossRevenueUsd)}</td>
                  <td className={scenario.netMarginUsd !== null && scenario.netMarginUsd >= 0 ? 'status-good' : 'status-warn'}>
                    {scenario.netMarginUsd === null ? 'Quote first' : formatUsd(scenario.netMarginUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="notice-callout">
          <strong>{profitability.guidance}</strong>
          <span>{profitability.market.note}</span>
          <span>{profitability.assumptionNote}</span>
          <span>
            Source: <a href={profitability.market.source.url} rel="noreferrer" target="_blank">{profitability.market.source.vendor}</a>
            {` | checked ${formatDate(profitability.market.source.checkedOn)}`}
          </span>
        </div>
      </article>

      <article className="subcard">
        <div className="section-header compact-header">
          <div>
            <h3>Board transaction center</h3>
            <p className="muted">{boardName} selling and delivery workflow for this crop.</p>
          </div>
          <span className={`badge ${boardStatus === 'verified' ? 'success' : boardStatus === 'linked' ? 'warning' : 'neutral'}`}>
            {boardStatus}
          </span>
        </div>

        <div className="metric-grid business-metric-grid">
          <div className="metric-card">
            <span>Suggested delivery volume</span>
            <strong>{projection.suggestedVolume.toFixed(projection.volumeUnit === 'kg' ? 0 : 2)}</strong>
            <small>{projection.volumeUnit}</small>
          </div>
          <div className="metric-card">
            <span>Delivery status</span>
            <strong>{transaction?.deliveryStatus ?? 'not-booked'}</strong>
            <small>{transaction?.deliveryPoint ?? 'No booking yet'}</small>
          </div>
          <div className="metric-card">
            <span>Payment status</span>
            <strong>{transaction?.paymentStatus ?? 'not-raised'}</strong>
            <small>{transaction?.paymentDueDate ? `Due around ${formatDate(transaction.paymentDueDate)}` : 'No payment timeline yet'}</small>
          </div>
        </div>

        <form className="form-grid compact" onSubmit={handleTransactionSave}>
          <label>
            Delivery point
            <select
              required
              value={transactionForm.deliveryPoint}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, deliveryPoint: event.target.value }))
              }
            >
              <option value="">Select delivery point</option>
              {deliveryOptions.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target delivery date
            <input
              required
              type="date"
              value={transactionForm.targetDeliveryDate}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, targetDeliveryDate: event.target.value }))
              }
            />
          </label>
          <label>
            Expected volume ({projection.volumeUnit})
            <input
              min="0.1"
              required
              step={projection.volumeUnit === 'kg' ? '1' : '0.1'}
              type="number"
              value={transactionForm.estimatedVolume}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, estimatedVolume: event.target.value }))
              }
            />
          </label>
          <label>
            Delivery notes
            <input
              type="text"
              value={transactionForm.notes}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Transport, grading, stop orders, contract notes"
            />
          </label>
          <button className="secondary-button" disabled={busy} type="submit">
            {transaction ? 'Update booking' : 'Save booking'}
          </button>
        </form>
        {transactionError ? <p className="muted">{transactionError}</p> : null}

        <div className="transaction-strip">
          <span className={`badge ${transaction ? getDeliveryStatusTone(transaction.deliveryStatus) : 'neutral'}`}>
            {transaction?.deliveryStatus ?? 'not-booked'}
          </span>
          <span className={`badge ${transaction ? getPaymentStatusTone(transaction.paymentStatus) : 'neutral'}`}>
            {transaction?.paymentStatus ?? 'not-raised'}
          </span>
          {transaction?.paymentReference ? <span className="badge accent">{transaction.paymentReference}</span> : null}
        </div>
        <p className="muted">{transactionSummary}</p>

        <div className="workflow-list">
          {workflow.map((step) => (
            <div className={`workflow-item ${step.status}`} key={step.title}>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
              {step.url ? (
                <a className="inline-link" href={step.url} rel="noreferrer" target="_blank">
                  {step.ctaLabel ?? 'Open'}
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <div className="market-bulletin">
          <strong>Delivery checklist</strong>
          {checklist.map((item) => (
            <span key={item.title}>{item.title}: {item.detail}</span>
          ))}
          <p>{profitability.market.paymentNote}</p>
          {profitability.market.secondaryPriceUsd ? (
            <small>{profitability.market.secondaryLabel}: {formatMarketValue(profitability.market.secondaryPriceUsd, profitability.market.unit)}</small>
          ) : null}
        </div>
      </article>

      <article className="subcard">
        <div className="section-header compact-header">
          <div>
            <h3>Support and finance hub</h3>
            <p className="muted">Trusted channels for agronomy, finance, insurance, and payments.</p>
          </div>
          <span className={`badge ${escalation.priority === 'urgent' ? 'warning' : 'neutral'}`}>{escalation.priority}</span>
        </div>
        <div className="notice-callout">
          <strong>{escalation.title}</strong>
          <span>{escalation.nextAction}</span>
          <span>{escalation.message}</span>
        </div>
        <div className="service-grid">
          {supportLinks.map((link) => (
            <article className="service-card" key={link.name}>
              <span className="service-kind">{link.kind}</span>
              <strong>{link.name}</strong>
              <p>{link.detail}</p>
              {link.contact ? <small>{link.contact}</small> : null}
              {link.url ? (
                <a className="inline-link" href={link.url} rel="noreferrer" target="_blank">
                  Open support
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </article>
    </>
  );
}

export default FarmBusinessDesk;
