import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { crops } from '../data';
import type {
  CropEnquiryRecord,
  FarmerCropPlan,
  HarvestRecord,
  PaymentMethod,
  PlantingProgressEntry,
  UserProfile,
} from '../lib/app-types';
import type { BudgetSummary } from '../lib/economics';
import {
  buildMarketplaceOrder,
  createPaymentRecord,
  getFarmerCases,
  getFarmerHarvests,
  getFarmerOrders,
  getFarmerPayments,
  getYieldSummary,
  saveHarvestRecord,
  syncCasesFromEnquiries,
} from '../lib/operations';
import { downloadJson, exportFarmerPerformanceReport } from '../lib/reports';
import type { AppPreferences } from '../lib/preferences';
import { getMobilePlatformLabel, isNativeMobileApp } from '../lib/mobile';
import VoiceGuideButton from './VoiceGuideButton';
import { supplierOffers } from '../lib/platform-catalog';
import { formatDate } from '../lib/weather';
import { formatUsd } from '../lib/economics';

interface FarmerOperationsDeskProps {
  profile: UserProfile;
  preferences: AppPreferences;
  budget: BudgetSummary | null;
  selectedCropId: FarmerCropPlan['cropId'];
  plans: FarmerCropPlan[];
  plantingEntries: PlantingProgressEntry[];
  enquiries: CropEnquiryRecord[];
}

function FarmerOperationsDesk({
  profile,
  preferences,
  budget,
  selectedCropId,
  plans,
  plantingEntries,
  enquiries,
}: FarmerOperationsDeskProps) {
  const [orders, setOrders] = useState(() => getFarmerOrders(profile.id));
  const [payments, setPayments] = useState(() => getFarmerPayments(profile.id));
  const [harvests, setHarvests] = useState(() => getFarmerHarvests(profile.id));
  const [cases, setCases] = useState(() => getFarmerCases(profile.id));
  const [orderNotes, setOrderNotes] = useState('');
  const [marketplaceMessage, setMarketplaceMessage] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    orderId: '',
    method: 'EcoCash' as PaymentMethod,
    reference: '',
  });
  const [harvestForm, setHarvestForm] = useState({
    harvestDate: new Date().toISOString().slice(0, 10),
    harvestedAreaHa: '',
    yieldAmount: '',
    yieldUnit: 't' as HarvestRecord['yieldUnit'],
    grade: 'A',
    moisturePct: '',
    lossesPct: '',
    notes: '',
  });
  const [harvestMessage, setHarvestMessage] = useState('');

  useEffect(() => {
    syncCasesFromEnquiries({
      farmer: profile,
      enquiries,
    });
    setCases(getFarmerCases(profile.id));
  }, [enquiries, profile]);

  useEffect(() => {
    setOrders(getFarmerOrders(profile.id));
    setPayments(getFarmerPayments(profile.id));
    setHarvests(getFarmerHarvests(profile.id));
    setCases(getFarmerCases(profile.id));
  }, [profile.id, selectedCropId]);

  const selectedCrop = crops.find((entry) => entry.id === selectedCropId) ?? null;
  const selectedPlan = plans.find((entry) => entry.cropId === selectedCropId) ?? null;
  const cropOrders = orders.filter((order) => order.cropId === selectedCropId);
  const cropHarvestSummary = getYieldSummary(profile.id, selectedCropId);
  const cropCases = cases.filter((record) => record.cropId === selectedCropId);
  const curatedOffers = supplierOffers.filter(
    (offer) => offer.cropId === selectedCropId && (!offer.regionIds || offer.regionIds.includes(profile.regionId)),
  );
  const voiceSummary = useMemo(() => {
    const cropName = selectedCrop?.name ?? selectedCropId;
    const latestCase = cropCases[0];
    return [
      `${cropName} operations summary for ${profile.fullName}.`,
      selectedPlan ? `Planned area ${selectedPlan.totalAreaHa.toFixed(1)} hectares.` : 'No saved crop plan yet.',
      budget ? `Estimated known input cost ${formatUsd(budget.knownCostUsd)}.` : 'No input budget loaded yet.',
      cropOrders.length ? `${cropOrders.length} marketplace order records are saved.` : 'No marketplace order has been saved yet.',
      cropHarvestSummary.records.length
        ? `Average recorded yield is ${cropHarvestSummary.averageYieldPerHa.toFixed(2)} ${cropHarvestSummary.records[0].yieldUnit} per hectare.`
        : 'No harvest records have been captured yet.',
      latestCase ? `Latest agronomist case status is ${latestCase.caseStatus ?? 'new'}.` : 'No agronomist case is open for this crop.',
    ].join(' ');
  }, [budget, cropCases, cropHarvestSummary, cropOrders.length, profile.fullName, selectedCrop?.name, selectedCropId, selectedPlan]);

  function refreshLocalRecords() {
    setOrders(getFarmerOrders(profile.id));
    setPayments(getFarmerPayments(profile.id));
    setHarvests(getFarmerHarvests(profile.id));
    setCases(getFarmerCases(profile.id));
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan || !budget || !selectedCrop) {
      setMarketplaceMessage('Save the crop plan and budget first so the marketplace order can be generated.');
      return;
    }

    const order = buildMarketplaceOrder({
      farmer: profile,
      cropId: selectedCrop.id,
      totalAreaHa: selectedPlan.totalAreaHa,
      budget,
      notes: orderNotes,
    });
    setMarketplaceMessage(`Marketplace order created for ${formatUsd(order.totalCostUsd)} across ${order.supplierCount} suppliers.`);
    setOrderNotes('');
    setPaymentForm((current) => ({ ...current, orderId: order.id }));
    refreshLocalRecords();
  }

  async function handlePaymentSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetOrder =
      cropOrders.find((order) => order.id === paymentForm.orderId) ??
      cropOrders.find((order) => order.status !== 'paid') ??
      cropOrders[0];

    if (!targetOrder) {
      setMarketplaceMessage('Create an order first so a payment record can be attached.');
      return;
    }

    const payment = await createPaymentRecord({
      farmerId: profile.id,
      orderId: targetOrder.id,
      amountUsd: targetOrder.totalCostUsd,
      method: paymentForm.method,
      reference: paymentForm.reference,
    });
    setMarketplaceMessage(
      payment.checkoutUrl
        ? `Payment session prepared with ${payment.provider ?? payment.method}. Open the payment link below to complete checkout.`
        : payment.statusNote
          ? payment.statusNote
          : `Payment record saved with ${payment.method}.`,
    );
    setPaymentForm((current) => ({ ...current, orderId: targetOrder.id, reference: '' }));
    refreshLocalRecords();
  }

  async function handleHarvestSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const harvestedAreaHa = Number(harvestForm.harvestedAreaHa);
    const yieldAmount = Number(harvestForm.yieldAmount);

    if (!selectedCrop || !Number.isFinite(harvestedAreaHa) || !Number.isFinite(yieldAmount) || harvestedAreaHa <= 0 || yieldAmount <= 0) {
      setHarvestMessage('Enter harvested area and yield before saving the harvest record.');
      return;
    }

    saveHarvestRecord({
      farmerId: profile.id,
      cropId: selectedCrop.id,
      harvestDate: harvestForm.harvestDate,
      harvestedAreaHa,
      yieldAmount,
      yieldUnit: harvestForm.yieldUnit,
      grade: harvestForm.grade,
      moisturePct: harvestForm.moisturePct ? Number(harvestForm.moisturePct) : undefined,
      lossesPct: harvestForm.lossesPct ? Number(harvestForm.lossesPct) : undefined,
      notes: harvestForm.notes,
    });

    setHarvestMessage('Harvest record saved.');
    setHarvestForm((current) => ({
      ...current,
      harvestedAreaHa: '',
      yieldAmount: '',
      moisturePct: '',
      lossesPct: '',
      notes: '',
    }));
    refreshLocalRecords();
  }

  return (
    <>
      <article className="subcard">
        <div className="section-header compact-header">
          <div>
            <h3>Input marketplace and payments</h3>
            <p className="muted">Generate order packs from the crop budget, then record how the farmer will pay.</p>
          </div>
          <span className="badge accent">{cropOrders.length} orders</span>
        </div>
        <div className="service-grid">
          {(curatedOffers.length ? curatedOffers : []).slice(0, 4).map((offer) => (
            <article className="service-card" key={offer.id}>
              <span className="service-kind">{offer.category}</span>
              <strong>{offer.productName}</strong>
              <p>{offer.supplierName}</p>
              <small>{offer.note}</small>
              <small>{offer.unitPriceUsd > 0 ? `${formatUsd(offer.unitPriceUsd)} | ${offer.unitLabel}` : 'Quote item'}</small>
              <a className="inline-link" href={offer.url} rel="noreferrer" target="_blank">
                Open supplier
              </a>
            </article>
          ))}
        </div>
        <form className="form-grid compact top-gap" onSubmit={handleCreateOrder}>
          <label>
            Order notes
            <input
              type="text"
              value={orderNotes}
              onChange={(event) => setOrderNotes(event.target.value)}
              placeholder="Preferred supplier, delivery location, finance note"
            />
          </label>
          <button className="secondary-button" type="submit">
            Create marketplace order
          </button>
        </form>

        <form className="form-grid compact top-gap" onSubmit={handlePaymentSave}>
          <label>
            Order to pay
            <select
              value={paymentForm.orderId}
              onChange={(event) => setPaymentForm((current) => ({ ...current, orderId: event.target.value }))}
            >
              <option value="">Latest open order</option>
              {cropOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.requestedAt.slice(0, 10)} | {formatUsd(order.totalCostUsd)} | {order.status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment method
            <select
              value={paymentForm.method}
              onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as PaymentMethod }))}
            >
              <option value="EcoCash">EcoCash</option>
              <option value="Bank transfer">Bank transfer</option>
              <option value="Card">Card</option>
              <option value="Cash on delivery">Cash on delivery</option>
            </select>
          </label>
          <label>
            Reference
            <input
              type="text"
              value={paymentForm.reference}
              onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
              placeholder="Merchant, transfer, or receipt reference"
            />
          </label>
          <button className="primary-button" type="submit">
            Save payment record
          </button>
        </form>

        {marketplaceMessage ? <p className="muted">{marketplaceMessage}</p> : null}
        {cropOrders.length ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Area</th>
                  <th>Suppliers</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cropOrders.slice(0, 4).map((order) => (
                  <tr key={order.id}>
                    <td>{formatDate(order.requestedAt.slice(0, 10))}</td>
                    <td>{order.totalAreaHa.toFixed(1)} ha</td>
                    <td>{order.supplierCount}</td>
                    <td>{formatUsd(order.totalCostUsd)}</td>
                    <td>{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {payments.length ? (
          <div className="service-grid top-gap">
            {payments
              .filter((payment) => payment.orderId && cropOrders.some((order) => order.id === payment.orderId))
              .slice(0, 3)
              .map((payment) => (
                <article className="service-card" key={payment.id}>
                  <span className={`badge ${payment.status === 'paid' ? 'success' : payment.status === 'initiated' ? 'warning' : 'neutral'}`}>
                    {payment.status}
                  </span>
                  <strong>{payment.provider ?? payment.method}</strong>
                  <p>{formatUsd(payment.amountUsd)}</p>
                  {payment.reference ? <small>Reference: {payment.reference}</small> : null}
                  {payment.statusNote ? <small>{payment.statusNote}</small> : null}
                  {payment.checkoutUrl ? (
                    <a className="inline-link" href={payment.checkoutUrl} rel="noreferrer" target="_blank">
                      Open payment link
                    </a>
                  ) : null}
                </article>
              ))}
          </div>
        ) : null}
      </article>

      <article className="subcard">
        <div className="section-header compact-header">
          <div>
            <h3>Harvest tracking and reports</h3>
            <p className="muted">Capture actual yield, quality, and losses so the farmer sees real performance per hectare.</p>
          </div>
          <span className="badge success">{cropHarvestSummary.records.length} harvests</span>
        </div>
        <div className="metric-grid business-metric-grid">
          <div className="metric-card compact-metric">
            <span>Total harvested area</span>
            <strong>{cropHarvestSummary.totalHarvestedAreaHa.toFixed(1)} ha</strong>
          </div>
          <div className="metric-card compact-metric">
            <span>Total output</span>
            <strong>{cropHarvestSummary.totalYieldAmount.toFixed(2)}</strong>
          </div>
          <div className="metric-card compact-metric">
            <span>Average yield / ha</span>
            <strong>{cropHarvestSummary.averageYieldPerHa.toFixed(2)}</strong>
          </div>
        </div>
        <form className="form-grid compact" onSubmit={handleHarvestSave}>
          <label>
            Harvest date
            <input
              required
              type="date"
              value={harvestForm.harvestDate}
              onChange={(event) => setHarvestForm((current) => ({ ...current, harvestDate: event.target.value }))}
            />
          </label>
          <label>
            Harvested area (ha)
            <input
              min="0.1"
              required
              step="0.1"
              type="number"
              value={harvestForm.harvestedAreaHa}
              onChange={(event) => setHarvestForm((current) => ({ ...current, harvestedAreaHa: event.target.value }))}
            />
          </label>
          <label>
            Yield amount
            <input
              min="0.1"
              required
              step="0.1"
              type="number"
              value={harvestForm.yieldAmount}
              onChange={(event) => setHarvestForm((current) => ({ ...current, yieldAmount: event.target.value }))}
            />
          </label>
          <label>
            Yield unit
            <select
              value={harvestForm.yieldUnit}
              onChange={(event) => setHarvestForm((current) => ({ ...current, yieldUnit: event.target.value as HarvestRecord['yieldUnit'] }))}
            >
              <option value="t">tonnes</option>
              <option value="kg">kg</option>
              <option value="bales">bales</option>
            </select>
          </label>
          <label>
            Grade
            <input
              required
              type="text"
              value={harvestForm.grade}
              onChange={(event) => setHarvestForm((current) => ({ ...current, grade: event.target.value }))}
            />
          </label>
          <label>
            Moisture %
            <input
              min="0"
              step="0.1"
              type="number"
              value={harvestForm.moisturePct}
              onChange={(event) => setHarvestForm((current) => ({ ...current, moisturePct: event.target.value }))}
            />
          </label>
          <label>
            Losses %
            <input
              min="0"
              step="0.1"
              type="number"
              value={harvestForm.lossesPct}
              onChange={(event) => setHarvestForm((current) => ({ ...current, lossesPct: event.target.value }))}
            />
          </label>
          <label>
            Notes
            <input
              type="text"
              value={harvestForm.notes}
              onChange={(event) => setHarvestForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Grade, moisture, handling, or storage notes"
            />
          </label>
          <button className="secondary-button" type="submit">Save harvest</button>
        </form>
        {harvestMessage ? <p className="muted">{harvestMessage}</p> : null}

        <div className="toolbar-actions top-gap">
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              exportFarmerPerformanceReport({
                profile,
                plans,
                plantingEntries,
                orders,
                payments,
                harvests,
                cases,
              })
            }
          >
            Export CSV report
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              downloadJson(`${profile.fullName.replace(/\s+/g, '-').toLowerCase()}-operations.json`, {
                profile,
                plans,
                plantingEntries,
                orders,
                payments,
                harvests,
                cases,
              })
            }
          >
            Export JSON pack
          </button>
        </div>
        <div className="notice-callout">
          <strong>Offline operations vault</strong>
          <span>Orders, harvests, payments, and case notes are stored locally so the farmer can still work in low-connectivity conditions.</span>
          <span>{isNativeMobileApp() ? `${getMobilePlatformLabel()} app shell is active for camera and device reminder support.` : 'Web shell is active. Mobile shells also support the same operations flow.'}</span>
        </div>
      </article>

      <article className="subcard">
        <div className="section-header compact-header">
          <div>
            <h3>Agronomist case tracker and voice</h3>
            <p className="muted">Follow response status, recommended products, and read the current crop summary aloud.</p>
          </div>
          <span className="badge accent">{cropCases.length} cases</span>
        </div>
        <div className="toolbar-actions">
          {preferences.voiceGuidance ? <VoiceGuideButton label="Read crop summary" text={voiceSummary} /> : null}
        </div>
        {cropCases.length ? (
          <div className="service-grid top-gap">
            {cropCases.slice(0, 4).map((record) => (
              <article className="service-card" key={record.id}>
                <span className={`badge ${record.caseStatus === 'resolved' ? 'success' : record.priority === 'urgent' ? 'warning' : 'neutral'}`}>
                  {record.caseStatus ?? 'new'}
                </span>
                <strong>{record.assignedAgronomistName ?? 'Waiting for agronomist'}</strong>
                <p>{record.note}</p>
                <small>{record.responseNote ?? 'No agronomist response saved yet.'}</small>
                {record.recommendedProduct ? <small>Recommended product: {record.recommendedProduct}</small> : null}
                <small>{formatDate(record.createdAt.slice(0, 10))}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No agronomist case has been opened for this crop yet. Saving an enquiry automatically creates one.</p>
        )}
      </article>
    </>
  );
}

export default FarmerOperationsDesk;
