import type { AppPreferences } from '../lib/preferences';
import { getAppCopy } from '../lib/preferences';

interface PreferencesBarProps {
  preferences: AppPreferences;
  onChange: (preferences: AppPreferences) => void;
}

function PreferencesBar({ preferences, onChange }: PreferencesBarProps) {
  const copy = getAppCopy(preferences.language);

  return (
    <section className="card preferences-card">
      <div className="section-header compact-header">
        <div>
          <p className="section-kicker">{copy.preferenceLabel}</p>
          <h2>{copy.preferenceLabel}</h2>
        </div>
        <span className="badge">{preferences.language.toUpperCase()}</span>
      </div>

      <div className="preferences-grid">
        <label>
          {copy.languageLabel}
          <select
            value={preferences.language}
            onChange={(event) =>
              onChange({
                ...preferences,
                language: event.target.value as AppPreferences['language'],
              })
            }
          >
            <option value="en">English</option>
            <option value="sn">Shona</option>
            <option value="nd">Ndebele</option>
          </select>
        </label>

        <label className="toggle-field">
          <span>{copy.textSizeLabel}</span>
          <input
            checked={preferences.largeText}
            type="checkbox"
            onChange={(event) =>
              onChange({
                ...preferences,
                largeText: event.target.checked,
              })
            }
          />
        </label>

        <label className="toggle-field">
          <span>{copy.alertsLabel}</span>
          <input
            checked={preferences.alertsEnabled}
            type="checkbox"
            onChange={(event) =>
              onChange({
                ...preferences,
                alertsEnabled: event.target.checked,
              })
            }
          />
        </label>

        <label className="toggle-field">
          <span>{copy.voiceLabel}</span>
          <input
            checked={preferences.voiceGuidance}
            type="checkbox"
            onChange={(event) =>
              onChange({
                ...preferences,
                voiceGuidance: event.target.checked,
              })
            }
          />
        </label>
      </div>
    </section>
  );
}

export default PreferencesBar;
