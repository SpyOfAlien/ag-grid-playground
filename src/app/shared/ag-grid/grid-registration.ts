import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';

declare global {
  interface Window {
    __CELL_KIT_CONFIG__?: { agGridLicenseKey?: string };
  }
}

export function registerDemoGrid(): void {
  const key = window.__CELL_KIT_CONFIG__?.agGridLicenseKey;
  if (key) LicenseManager.setLicenseKey(key);
  ModuleRegistry.registerModules([AllEnterpriseModule]);
}
