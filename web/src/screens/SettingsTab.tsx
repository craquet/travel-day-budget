import { useEffect, useState } from 'react';
import type { TripInput } from '../../../shared/types.js';
import { useStore } from '../store';
import { formatMoney, tripRangeLabel } from '../format';
import { TripFormSheet } from './TripsScreen';
import { ConfirmButton, PersonAvatar } from '../components/ui';
import { IconTrash } from '../components/icons';

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

      <MembersManager />

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

function MembersManager() {
  const { members, addMember, renameMember, removeMember } = useStore();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await addMember(name);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-title" style={{ margin: 0 }}>
        People
      </div>
      {members.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          No people yet. Add people who can be assigned to expenses as the payer.
        </p>
      ) : (
        members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            onRename={(name) => renameMember(m.id, name)}
            onRemove={() => removeMember(m.id)}
          />
        ))
      )}
      <div className="form-row">
        <input
          className="input"
          placeholder="Name"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="New person name"
        />
        <button type="button" className="btn" style={{ flex: '0 0 auto' }} onClick={submit} disabled={busy || !newName.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  onRename,
  onRemove,
}: {
  member: { id: string; name: string; color: string };
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== member.name) onRename(trimmed);
  };

  return (
    <div className="member-row">
      <PersonAvatar name={member.name} color={member.color} />
      <input
        className="input"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label={`Rename ${member.name}`}
      />
      <button
        type="button"
        className={`iconbtn${armed ? ' danger' : ''}`}
        aria-label={armed ? `Confirm remove ${member.name}` : `Remove ${member.name}`}
        onClick={() => (armed ? onRemove() : setArmed(true))}
        onBlur={() => setArmed(false)}
      >
        {armed ? '✓' : <IconTrash size={16} />}
      </button>
    </div>
  );
}
