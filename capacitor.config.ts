import type { CapacitorConfig } from '@capacitor/cli';
import { appConfig } from './src/app/config';
const config: CapacitorConfig = {
  appId: appConfig.packageId,
  appName: appConfig.name,
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: { androidIsEncryption: true, iosIsEncryption: true },
    PrivacyScreen: { enable: false },
    SplashScreen: { launchAutoHide: false, backgroundColor: '#F3F6FB' },
    Keyboard: {
      resize: 'native',
      style: 'default',
      accessoryBarVisible: false,
    },
  },
};
export default config;
