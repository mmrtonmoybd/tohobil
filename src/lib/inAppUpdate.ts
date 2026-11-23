export interface AppVersionConfig {
  min_version?: string;
  latest_version?: string;
  release_notes?: string;
  store_url?: string;
}

export interface UpdateCheckResult {
  updateRequired: boolean;
  updateAvailable: boolean;
  minVersion?: string;
  latestVersion?: string;
  releaseNotes?: string;
  storeUrl?: string;
}

export function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '').trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function isVersionOlder(current: string, target: string): boolean {
  const [cMaj, cMin, cPatch] = parseSemver(current);
  const [tMaj, tMin, tPatch] = parseSemver(target);

  if (cMaj < tMaj) return true;
  if (cMaj > tMaj) return false;

  if (cMin < tMin) return true;
  if (cMin > tMin) return false;

  return cPatch < tPatch;
}

export function evaluateUpdate(
  currentVersion: string,
  config: AppVersionConfig,
): UpdateCheckResult {
  const updateRequired = config.min_version
    ? isVersionOlder(currentVersion, config.min_version)
    : false;

  const updateAvailable = config.latest_version
    ? isVersionOlder(currentVersion, config.latest_version)
    : false;

  return {
    updateRequired,
    updateAvailable: !updateRequired && updateAvailable,
    minVersion: config.min_version,
    latestVersion: config.latest_version,
    releaseNotes: config.release_notes,
    storeUrl:
      config.store_url ||
      'https://play.google.com/store/apps/details?id=com.tohobil.app',
  };
}
