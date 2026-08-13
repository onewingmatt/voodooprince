export const SETTINGS_KEY = 'voodoo-prince-settings';

export const DEFAULTS = {
  soundEnabled: true,
  effectsEnabled: true,
};

export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...DEFAULTS, ...stored };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
