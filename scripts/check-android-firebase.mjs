import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateAndroidFirebase(config, appId, projectId) {
  if (config?.project_info?.project_id !== projectId) {
    throw new Error(`google-services.json must belong to Firebase project ${projectId}.`);
  }
  const client = config.client?.find((c) => c.client_info?.android_client_info?.package_name === appId);
  if (!client?.client_info?.mobilesdk_app_id || !client.api_key?.some((k) => k.current_key)) {
    throw new Error(`google-services.json needs a Firebase Android client for ${appId}.`);
  }
  if (!client.oauth_client?.some((c) => c.client_type === 3 && c.client_id?.endsWith('.apps.googleusercontent.com'))) {
    throw new Error('Missing Web OAuth client (client_type 3). Enable Google sign-in in Firebase and download google-services.json again.');
  }
  if (!client.oauth_client?.some((c) => c.client_type === 1 && c.android_info?.package_name === appId && c.android_info?.certificate_hash)) {
    throw new Error('Missing Android OAuth client / SHA fingerprint. Register the APK signing certificate in Firebase and download google-services.json again.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const capacitor = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
    const config = JSON.parse(readFileSync('android/app/google-services.json', 'utf8'));
    validateAndroidFirebase(config, capacitor.appId, 'nexora-social-2026');
    console.log('Android Firebase configuration is valid. Verify the release signing SHA also matches Firebase.');
  } catch (error) {
    console.error(`Android Google sign-in configuration failed: ${error.message}`);
    console.error('Provide android/app/google-services.json locally or the GOOGLE_SERVICES_JSON GitHub Actions secret.');
    process.exitCode = 1;
  }
}
