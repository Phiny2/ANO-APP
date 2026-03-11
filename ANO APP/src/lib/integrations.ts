import type {
  BoardIntegrationMode,
  BoardIntegrationRecord,
  BoardTransactionRecord,
  CropEnquiryRecord,
  PaymentMethod,
  PaymentRecordStatus,
  UserProfile,
} from './app-types';
import { defaultBoardIntegrations } from './platform-catalog';

interface PlatformIntegrationConfig {
  diagnosisApiUrl?: string;
  boardSyncApiUrl?: string;
  boardSyncApiKey?: string;
  paymentsApiUrl?: string;
  ecocashMerchantCode?: string;
  pushGatewayUrl?: string;
  webPushPublicKey?: string;
  agronomistCaseApiUrl?: string;
}

interface GatewayPaymentSession {
  provider?: string;
  status: PaymentRecordStatus;
  reference?: string;
  checkoutUrl?: string;
  note?: string;
}

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildMode(mode: BoardIntegrationMode, configured: boolean, partial = false) {
  if (!configured) {
    return {
      configured: false,
      mode: 'demo' as const,
      status: partial ? ('warning' as const) : ('planned' as const),
    };
  }

  if (partial) {
    return {
      configured: true,
      mode: 'hybrid' as const,
      status: 'warning' as const,
    };
  }

  return {
    configured: true,
    mode,
    status: 'connected' as const,
  };
}

export function getPlatformIntegrationConfig(): PlatformIntegrationConfig {
  return {
    diagnosisApiUrl: cleanEnv(import.meta.env.VITE_DIAGNOSIS_API_URL),
    boardSyncApiUrl: cleanEnv(import.meta.env.VITE_BOARD_SYNC_API_URL),
    boardSyncApiKey: cleanEnv(import.meta.env.VITE_BOARD_SYNC_API_KEY),
    paymentsApiUrl: cleanEnv(import.meta.env.VITE_PAYMENTS_API_URL),
    ecocashMerchantCode: cleanEnv(import.meta.env.VITE_ECOCASH_MERCHANT_CODE),
    pushGatewayUrl: cleanEnv(import.meta.env.VITE_PUSH_GATEWAY_URL),
    webPushPublicKey: cleanEnv(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY),
    agronomistCaseApiUrl: cleanEnv(import.meta.env.VITE_AGRONOMIST_CASE_API_URL),
  };
}

function resolveIntegrationRecord(record: BoardIntegrationRecord) {
  const config = getPlatformIntegrationConfig();

  switch (record.id) {
    case 'diagnosis-engine': {
      const live = Boolean(config.diagnosisApiUrl);
      const status = buildMode('live', live);
      return {
        ...record,
        ...status,
        provider: live ? 'AI diagnosis API' : 'Local crop guide fallback',
        endpoint: config.diagnosisApiUrl ?? record.endpoint,
        requirements: live ? [] : ['VITE_DIAGNOSIS_API_URL'],
        summary: live
          ? 'Live image diagnosis is configured. Crop photos can be sent to the diagnosis service.'
          : 'Camera capture is live, but full image diagnosis still falls back to the local crop guide until the diagnosis API is configured.',
      };
    }
    case 'push-campaigns': {
      const endpointConfigured = Boolean(config.pushGatewayUrl);
      const keyConfigured = Boolean(config.webPushPublicKey);
      const partial = endpointConfigured || keyConfigured;
      const status = buildMode('live', endpointConfigured && keyConfigured, partial);
      return {
        ...record,
        ...status,
        provider: endpointConfigured ? 'Push campaign gateway' : 'Browser and device alerts',
        endpoint: config.pushGatewayUrl ?? record.endpoint,
        requirements:
          endpointConfigured && keyConfigured
            ? []
            : ['VITE_PUSH_GATEWAY_URL', 'VITE_WEB_PUSH_PUBLIC_KEY'],
        summary:
          endpointConfigured && keyConfigured
            ? 'Server-driven push delivery is configured for web and mobile registration flows.'
            : partial
              ? 'Part of the push stack is configured. Finish both the gateway endpoint and public push key to enable real campaign delivery.'
              : 'Local browser and native reminders are active. Server-driven push still needs rollout credentials.',
      };
    }
    case 'payments-gateway': {
      const endpointConfigured = Boolean(config.paymentsApiUrl);
      const merchantConfigured = Boolean(config.ecocashMerchantCode);
      const partial = endpointConfigured || merchantConfigured;
      const status = buildMode('live', endpointConfigured && merchantConfigured, partial);
      return {
        ...record,
        ...status,
        provider: endpointConfigured ? 'Payments gateway' : 'Manual payment capture',
        endpoint: config.paymentsApiUrl ?? record.endpoint,
        requirements:
          endpointConfigured && merchantConfigured
            ? []
            : ['VITE_PAYMENTS_API_URL', 'VITE_ECOCASH_MERCHANT_CODE'],
        summary:
          endpointConfigured && merchantConfigured
            ? 'EcoCash or bank checkout sessions can now be prepared from the farmer payment flow.'
            : partial
              ? 'The payment endpoint is partially configured. Add the missing merchant or API configuration to activate checkout.'
              : 'Farmer payment records are captured in-app, but live EcoCash or bank checkout still needs gateway credentials.',
      };
    }
    case 'agronomist-dispatch': {
      const live = Boolean(config.agronomistCaseApiUrl);
      const status = buildMode('live', live);
      return {
        ...record,
        ...status,
        provider: live ? 'Agronomist case gateway' : 'In-app case queue',
        endpoint: config.agronomistCaseApiUrl ?? record.endpoint,
        requirements: live ? [] : ['VITE_AGRONOMIST_CASE_API_URL'],
        summary: live
          ? 'Farmer enquiries and agronomist responses can be mirrored to a live escalation endpoint.'
          : 'Agronomist case management is active in-app. Add a case API endpoint to mirror and route those updates externally.',
      };
    }
    case 'gmb-registry':
    case 'timb-bookings':
    case 'sugar-contracts': {
      const endpointConfigured = Boolean(config.boardSyncApiUrl);
      const keyConfigured = Boolean(config.boardSyncApiKey);
      const partial = endpointConfigured || keyConfigured;
      const status = buildMode('live', endpointConfigured && keyConfigured, partial);
      return {
        ...record,
        ...status,
        provider: endpointConfigured ? 'Board sync gateway' : 'In-app board workflow',
        endpoint: config.boardSyncApiUrl ?? record.endpoint,
        requirements:
          endpointConfigured && keyConfigured
            ? []
            : ['VITE_BOARD_SYNC_API_URL', 'VITE_BOARD_SYNC_API_KEY'],
        summary:
          endpointConfigured && keyConfigured
            ? 'Board transaction and verification events can now be forwarded to the national board sync endpoint.'
            : partial
              ? 'Board sync is partially configured. Add the missing secure key or endpoint to complete live forwarding.'
              : record.summary,
      };
    }
    default:
      return record;
  }
}

export function getConfiguredIntegrationRecords() {
  return defaultBoardIntegrations.map((record) => resolveIntegrationRecord(record));
}

async function postJson(url: string, payload: Record<string, unknown>, apiKey?: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Integration request failed with status ${response.status}.`);
  }

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getDiagnosisApiUrl() {
  return getPlatformIntegrationConfig().diagnosisApiUrl;
}

export async function syncBoardTransactionToGateway(input: {
  actor: UserProfile;
  transaction: BoardTransactionRecord;
  action: 'upsert' | 'status-update';
}) {
  const config = getPlatformIntegrationConfig();
  if (!config.boardSyncApiUrl) {
    return null;
  }

  return postJson(
    config.boardSyncApiUrl,
    {
      event: 'board-transaction',
      action: input.action,
      actorId: input.actor.id,
      actorRole: input.actor.role,
      boardId: input.transaction.boardId,
      transaction: input.transaction,
    },
    config.boardSyncApiKey,
  );
}

export async function createGatewayPaymentSession(input: {
  farmerId: string;
  orderId: string;
  amountUsd: number;
  method: PaymentMethod;
  reference?: string;
}) {
  const config = getPlatformIntegrationConfig();
  if (!config.paymentsApiUrl) {
    return null;
  }

  const payload = await postJson(config.paymentsApiUrl, {
    event: 'payment-intent',
    farmerId: input.farmerId,
    orderId: input.orderId,
    amountUsd: input.amountUsd,
    method: input.method,
    reference: input.reference,
    merchantCode: config.ecocashMerchantCode,
  });

  return {
    provider: typeof payload.provider === 'string' ? payload.provider : 'Configured gateway',
    status:
      payload.status === 'paid'
        ? 'paid'
        : typeof payload.checkoutUrl === 'string'
          ? 'initiated'
          : 'pending',
    reference: typeof payload.reference === 'string' ? payload.reference : input.reference,
    checkoutUrl: typeof payload.checkoutUrl === 'string' ? payload.checkoutUrl : undefined,
    note:
      typeof payload.note === 'string'
        ? payload.note
        : typeof payload.checkoutUrl === 'string'
          ? 'Checkout session created.'
          : 'Payment request sent to the configured gateway.',
  } satisfies GatewayPaymentSession;
}

export async function syncAgronomistCaseToGateway(input: {
  actor?: UserProfile;
  profile: UserProfile;
  enquiry?: CropEnquiryRecord;
  caseRecord?: unknown;
  action: 'enquiry-created' | 'case-updated';
}) {
  const config = getPlatformIntegrationConfig();
  if (!config.agronomistCaseApiUrl) {
    return null;
  }

  return postJson(config.agronomistCaseApiUrl, {
    event: 'agronomist-case',
    action: input.action,
    actorId: input.actor?.id,
    actorRole: input.actor?.role,
    profileId: input.profile.id,
    regionId: input.profile.regionId,
    enquiry: input.enquiry,
    caseRecord: input.caseRecord,
  });
}
