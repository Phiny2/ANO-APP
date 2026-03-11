import type { CropGuide } from '../data';
import type { BoardTransactionRecord, FarmerCropPlan } from './app-types';
import type { PlantingProgressSummary } from './economics';
import {
  getInitialNotificationPermission,
  isNativeMobileApp,
  readDeviceNotificationPermission,
  requestDeviceNotificationPermission,
  sendNativeReminderNotification,
} from './mobile';
import type { WeatherSummary } from './weather';

export interface FarmReminder {
  id: string;
  title: string;
  detail: string;
  severity: 'urgent' | 'watch' | 'ready';
}

const notificationKey = 'ano-last-reminder';

function addDays(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

export function buildFarmReminders(input: {
  crop: CropGuide | null;
  plan: FarmerCropPlan | null;
  transaction: BoardTransactionRecord | null;
  progressSummary: PlantingProgressSummary;
  weather: WeatherSummary | null;
  alerts: string[];
}) {
  const reminders: FarmReminder[] = [];

  if (!input.plan) {
    reminders.push({
      id: 'plan',
      title: 'Save the crop plan first',
      detail: 'Enter planting date and total hectares so the app can unlock schedules, budgets, and reminders.',
      severity: 'urgent',
    });
    return reminders;
  }

  if (input.progressSummary.remainingAreaHa > 0) {
    reminders.push({
      id: 'planting-progress',
      title: 'Keep planting records current',
      detail: `${input.progressSummary.remainingAreaHa.toFixed(1)} ha still needs to be recorded before the field is fully planted.`,
      severity: input.progressSummary.status === 'in-progress' ? 'urgent' : 'watch',
    });
  }

  if (input.weather && input.weather.tomorrowRainChance >= 60) {
    reminders.push({
      id: 'rain-delay',
      title: 'Delay fertiliser if rain is due',
      detail: `${input.weather.tomorrowRainChance}% chance of rain tomorrow. Hold top dressing and herbicide decisions until the forecast settles.`,
      severity: 'urgent',
    });
  }

  input.alerts.slice(0, 2).forEach((alert, index) => {
    reminders.push({
      id: `alert-${index}`,
      title: 'Season alert',
      detail: alert,
      severity: 'watch',
    });
  });

  if (input.crop && input.plan) {
    const activePlan = input.plan;
    const nextTask = input.crop.schedule.find(
      (task) => addDays(activePlan.plantingDate, task.dayOffset) >= new Date().toISOString().slice(0, 10),
    );
    if (nextTask) {
      reminders.push({
        id: `task-${nextTask.title}`,
        title: nextTask.title,
        detail: `Stage: ${nextTask.stage}. Planned around ${addDays(activePlan.plantingDate, nextTask.dayOffset)}.`,
        severity: nextTask.kind === 'fertiliser' ? 'urgent' : 'ready',
      });
    }
  }

  if (input.transaction) {
    reminders.push({
      id: 'board-transaction',
      title: 'Board transaction status',
      detail:
        input.transaction.paymentStatus === 'paid'
          ? 'Payment has been completed for the current booking.'
          : `Delivery is ${input.transaction.deliveryStatus} and payment is ${input.transaction.paymentStatus}.`,
      severity:
        input.transaction.paymentStatus === 'paid'
          ? 'ready'
          : input.transaction.deliveryStatus === 'delivered'
            ? 'watch'
            : 'urgent',
    });
  }

  return reminders.sort((left, right) => {
    const order = { urgent: 0, watch: 1, ready: 2 } as const;
    return order[left.severity] - order[right.severity];
  });
}

export function notificationsSupported() {
  return isNativeMobileApp() || (typeof window !== 'undefined' && 'Notification' in window);
}

export function getNotificationPermissionState() {
  return getInitialNotificationPermission();
}

export async function readNotificationPermission() {
  if (!notificationsSupported()) {
    return 'denied' as NotificationPermission;
  }

  if (isNativeMobileApp()) {
    return readDeviceNotificationPermission();
  }

  return window.Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) {
    return 'denied' as NotificationPermission;
  }

  if (isNativeMobileApp()) {
    return requestDeviceNotificationPermission();
  }

  return window.Notification.requestPermission();
}

export function maybeSendReminderNotification(reminder: FarmReminder | null, cropName: string) {
  if (!reminder || !notificationsSupported()) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `${notificationKey}:${cropName}:${reminder.id}:${today}`;

  if (isNativeMobileApp()) {
    void sendNativeReminderNotification({
      cacheKey,
      title: `${cropName} reminder`,
      body: `${reminder.title}: ${reminder.detail}`,
    });
    return;
  }

  if (window.Notification.permission !== 'granted' || window.localStorage.getItem(cacheKey)) {
    return;
  }

  new window.Notification(`${cropName} reminder`, {
    body: `${reminder.title}: ${reminder.detail}`,
  });
  window.localStorage.setItem(cacheKey, 'sent');
}
