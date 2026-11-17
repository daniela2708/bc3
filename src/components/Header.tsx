import { Info, Lock } from 'lucide-react';
import { useLock } from './PasswordGate';

export function Header({ onOpenDefinitions }: { onOpenDefinitions: () => void }) {
  const lock = useLock();
  return (
    <header className="app-header">
      <span className="weis-badge">
        <img src="/weis-1-logo-svg-vector.svg" alt="Weis Markets" width={32} height={32} />
      </span>
      <h1 className="app-title">Weis · Promo Effectiveness</h1>
      <span className="header-spacer" />
      <button type="button" className="btn-outline-light" onClick={onOpenDefinitions}>
        <Info size={15} aria-hidden="true" />
        KPI definitions
      </button>
      {lock && (
        <button type="button" className="btn-outline-light" onClick={lock} title="End this session">
          <Lock size={15} aria-hidden="true" />
          Lock
        </button>
      )}
      <img className="wizeline-mark" src="/wizelinered.svg" alt="Wizeline" width={28} height={20} />
    </header>
  );
}

export function Disclaimer() {
  return (
    <div className="disclaimer" role="note">
      <b>Illustrative data only.</b> Every figure is simulated for prototype demonstration; brand names are used for illustration and no
      figure reflects Weis Markets or vendor results. Items marked <b>Definition pending</b> await business confirmation.
    </div>
  );
}
