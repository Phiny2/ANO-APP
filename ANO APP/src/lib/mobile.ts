import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const nativeNotificationKey = 'ano-native-reminder';

export interface NativePhotoCapture {
  file: File;
  previewUrl: string;
}

function mapPermissionState(value: string): NotificationPermission {
  if (value === 'granted') {
    return 'granted';
  }

  if (value === 'denied') {
    return 'denied';
  }

  return 'default';
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || 'image/jpeg',
  });
}

function buildNotificationId(cacheKey: string) {
  let hash = 0;
  for (let index = 0; index < cacheKey.length; index += 1) {
    hash = (hash * 31 + cacheKey.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) || 1;
}

export function isNativeMobileApp() {
  return Capacitor.isNativePlatform();
}

export function getMobilePlatformLabel() {
  if (!isNativeMobileApp()) {
    return 'device';
  }

  return Capacitor.getPlatform() === 'ios' ? 'iPhone' : 'Android';
}

export function getInitialNotificationPermission() {
  if (isNativeMobileApp()) {
    return 'default' as NotificationPermission;
  }

  return typeof window !== 'undefined' && 'Notification' in window
    ? window.Notification.permission
    : ('denied' as NotificationPermission);
}

export async function readDeviceNotificationPermission() {
  if (!isNativeMobileApp()) {
    return getInitialNotificationPermission();
  }

  const permissions = await LocalNotifications.checkPermissions();
  return mapPermissionState(permissions.display);
}

export async function requestDeviceNotificationPermission() {
  if (!isNativeMobileApp()) {
    return getInitialNotificationPermission();
  }

  const permissions = await LocalNotifications.requestPermissions();
  return mapPermissionState(permissions.display);
}

export async function sendNativeReminderNotification(input: {
  cacheKey: string;
  title: string;
  body: string;
}) {
  if (!isNativeMobileApp()) {
    return;
  }

  const permission = await readDeviceNotificationPermission();
  if (permission !== 'granted') {
    return;
  }

  const storedKey = `${nativeNotificationKey}:${input.cacheKey}`;
  if (typeof window !== 'undefined' && window.localStorage.getItem(storedKey)) {
    return;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: buildNotificationId(input.cacheKey),
        title: input.title,
        body: input.body,
        schedule: {
          at: new Date(Date.now() + 1000),
        },
      },
    ],
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storedKey, 'sent');
  }
}

export async function captureCropPhotoFromDevice(): Promise<NativePhotoCapture> {
  const photo = await Camera.getPhoto({
    quality: 82,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true,
  });

  if (!photo.dataUrl) {
    throw new Error('Photo capture was cancelled.');
  }

  const file = await dataUrlToFile(photo.dataUrl, `crop-photo-${Date.now()}.jpeg`);

  return {
    file,
    previewUrl: photo.dataUrl,
  };
}

export async function configureNativeShell() {
  if (!isNativeMobileApp()) {
    return;
  }

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#040a0e' });
  } catch {
    // Ignore platform-specific status bar failures.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Ignore if the splash screen is already hidden.
  }
}
