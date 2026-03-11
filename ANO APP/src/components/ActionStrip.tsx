import type { FarmReminder } from '../lib/reminders';

interface ActionStripProps {
  title: string;
  subtitle: string;
  reminders: FarmReminder[];
}

function ActionStrip({ title, subtitle, reminders }: ActionStripProps) {
  return (
    <section className="card action-strip-card">
      <div className="section-header compact-header">
        <div>
          <p className="section-kicker">Action strip</p>
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
        </div>
      </div>

      <div className="action-strip-grid">
        {reminders.length ? (
          reminders.slice(0, 4).map((reminder) => (
            <article className={`action-tile ${reminder.severity}`} key={reminder.id}>
              <span className={`badge ${reminder.severity === 'urgent' ? 'warning' : reminder.severity === 'ready' ? 'success' : 'neutral'}`}>
                {reminder.severity}
              </span>
              <strong>{reminder.title}</strong>
              <p>{reminder.detail}</p>
            </article>
          ))
        ) : (
          <article className="action-tile ready">
            <span className="badge success">ready</span>
            <strong>No urgent actions</strong>
            <p>The dashboard will surface weather, planting, and board alerts here as your season progresses.</p>
          </article>
        )}
      </div>
    </section>
  );
}

export default ActionStrip;
