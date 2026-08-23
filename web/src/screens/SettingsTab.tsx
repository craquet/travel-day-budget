import { useState } from 'react';
import type { TripInput } from '../../../shared/types.js';
import { useStore } from '../store';
import { formatMoney, tripRangeLabel } from '../format';
import { TripFormSheet } from './TripsScreen';
import { ConfirmButton } from '../components/ui';

export function SettingsTab() {
  const { trip, updateTrip, deleteTrip, exportTrip, selectTrip } = useStore();
  const [editing, setEditing] = useState(false);

  if (!trip) return null;

  return (
    <div className="page">
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong style={{ fontSize: 17 }}>{trip.name}</strong>
        <span className="small muted">
          {tripRangeLabel(trip)} · {trip.days} days · {formatMoney(trip.dailyBudgetCents, trip.currency)}/day
        </span>
        <span className="small muted">
          Total pool: {formatMoney(trip.days * trip.dailyBudgetCents, trip.currency)} · Currency {trip.currency}
        </span>
        <button className="btn block" onClick={() => setEditing(true)}>
          Edit trip
        </button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Data
        </div>
        <button className="btn block" onClick={() => exportTrip(trip)}>
          Export as JSON
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          Receipt photos are stored on the server and are not included in the export.
        </p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="section-title" style={{ margin: 0, color: 'var(--bad)' }}>
          Danger zone
        </div>
        <ConfirmButton
          label="Delete this trip"
          confirmLabel="Tap again to permanently delete"
          onConfirm={() => {
            void deleteTrip(trip.id);
            selectTrip(null);
          }}
        />
        <p className="small muted" style={{ margin: 0 }}>
          Deletes the trip with all its expenses and receipt photos. This cannot be undone.
        </p>
      </div>

      <p className="small muted" style={{ textAlign: 'center', margin: '4px 0 0' }}>
        Travel Day Budget · self-hosted
      </p>

      {editing && (
        <TripFormSheet
          existing={trip}
          onClose={() => setEditing(false)}
          onSubmit={async (input: TripInput) => {
            await updateTrip(trip.id, input);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
