import type { BackendStatus } from '../lib/app-types';
import type { AppPreferences } from '../lib/preferences';
import { getAppCopy } from '../lib/preferences';

interface HeroBannerProps {
  backend: BackendStatus;
  preferences: AppPreferences;
}

function HeroBanner({ backend, preferences }: HeroBannerProps) {
  const copy = getAppCopy(preferences.language);

  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">{copy.heroEyebrow}</p>
        <h1>{copy.heroTitle}</h1>
        <p className="hero-text">{copy.heroText}</p>
        <div className="hero-chip-row">
          <span className="hero-chip">Farmer-first guidance</span>
          <span className="hero-chip">Buyer-connected records</span>
          <span className="hero-chip">Agronomist escalation</span>
          <span className="hero-chip">Farm team accounts</span>
          <span className="hero-chip">Admin command center</span>
          <span className="hero-chip">Dark national command center</span>
        </div>
        <div className="status-callout">
          <strong>{backend.mode === 'online' ? 'Online mode' : 'Demo mode'}</strong>
          <span>{backend.detail}</span>
        </div>
      </div>

      <div className="hero-panel">
        <p className="panel-label">Built for national scale</p>
        <div className="hero-stat-grid">
          <article className="hero-stat">
            <strong>5</strong>
            <span>major crop programs loaded</span>
          </article>
          <article className="hero-stat">
            <strong>2</strong>
            <span>countries already configured</span>
          </article>
          <article className="hero-stat">
            <strong>5</strong>
            <span>user roles working together</span>
          </article>
        </div>
        <ul>
          <li>Shared farmer and board records in one backend</li>
          <li>Agronomist directory filtered by crop, issue, and region</li>
          <li>Farm staff accounts linked to a farmer through invite codes</li>
          <li>Admin console for integrations, suppliers, and release readiness</li>
          <li>Region-specific crop access and variety recommendations</li>
          <li>Weather-aware fertiliser and irrigation decisions</li>
          <li>Next-season crop ranking with per-hectare cost forecasting</li>
          <li>Photo-ready crop enquiry records with storage support</li>
          <li>Offline caching and queued sync for weak network areas</li>
          <li>Firebase-backed auth, data sync, and crop photo storage</li>
        </ul>
      </div>
    </header>
  );
}

export default HeroBanner;
