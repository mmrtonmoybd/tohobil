import { registerPlugin } from '@capacitor/core';
const SystemBars = registerPlugin<{
  setAppearance(options: {
    backgroundColor: string;
    dark: boolean;
  }): Promise<void>;
}>('SystemBars');
export async function updateSystemBars(dark: boolean) {
  await SystemBars.setAppearance({
    backgroundColor: dark ? '#0B1120' : '#F3F6FB',
    dark,
  });
}
