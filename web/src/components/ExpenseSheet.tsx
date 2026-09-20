import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../../../shared/types.js';
import type { Expense } from '../../../shared/types.js';
import { addDays } from '../../../shared/dates.js';
import { useStore } from '../store';
import { categoryColor, parseAmountInput } from '../format';
import { Sheet } from './ProgressRing';
import { IconCamera, IconTrash } from './icons';

export interface ExpenseDraftTarget {
  /** null → create; set → edit existing */
  expense: Expense | null;
  defaultDate: string;
}

export function ExpenseSheet({ target, onClose }: { target: ExpenseDraftTarget; onClose: () => void }) {
  const { trip, members, createExpense, updateExpense, deleteExpense } = useStore();
  const editing = target.expense;

  const clampDate = useMemo(() => {
    if (!trip) return target.defaultDate;
    const min = trip.startDate;
    const max = addDays(trip.startDate, trip.days - 1);
    const d = target.defaultDate;
    return d < min ? min : d > max ? max : d;
  }, [trip, target.defaultDate]);

  const [amountRaw, setAmountRaw] = useState(editing ? (editing.amountCents / 100).toFixed(2) : '');
  const [date, setDate] = useState(editing?.date ?? clampDate);
  const [category, setCategory] = useState<string>(editing?.category ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [personId, setPersonId] = useState<string>(editing?.personId ?? '');

  const [existingPhotos, setExistingPhotos] = useState(
    () => editing?.photos.map((p) => ({ id: p.id, url: p.url })) ?? [],
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => document.getElementById('exp-amount')?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  if (!trip) return null;

  const amountCents = parseAmountInput(amountRaw);
  const valid = amountCents !== null;

  const pickFiles = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setNewFiles((prev) => [...prev, ...imgs].slice(0, 6 - existingPhotos.length - removedIds.length));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const payload = {
        date,
        amountCents,
        title: title.trim() || null,
        category: category.trim() || null,
        note: note.trim() || null,
        personId: personId || null,
      };
      if (editing) {
        await updateExpense(editing.id, payload, newFiles, removedIds);
      } else {
        await createExpense(payload, newFiles);
      }
      onClose();
    } catch {
      /* toast already shown by store */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      await deleteExpense(editing.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const previewUrls = newFiles.map((f) => URL.createObjectURL(f));

  return (
    <Sheet title={editing ? 'Edit expense' : 'New expense'} onClose={onClose}>
      <div className="field">
        <label htmlFor="exp-amount">Amount</label>
        <input
          id="exp-amount"
          className="input big amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amountRaw}
          onChange={(e) => setAmountRaw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valid && save()}
        />
        {!valid && amountRaw.length > 0 && (
          <span className="small" style={{ color: 'var(--bad)' }}>
            Enter a valid positive amount
          </span>
        )}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="exp-date">Date</label>
          <input
            id="exp-date"
            className="input"
            type="date"
            min={trip.startDate}
            max={addDays(trip.startDate, trip.days - 1)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="exp-title">Title (optional)</label>
          <input
            id="exp-title"
            className="input"
            maxLength={80}
            placeholder="e.g. Bus tickets"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Category</label>
        <div className="chips-row">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`cat-chip${category === c ? ' selected' : ''}`}
              onClick={() => setCategory(category === c ? '' : c)}
            >
              <span className="catdot" style={{ background: categoryColor(c) }} />
              {c}
            </button>
          ))}
        </div>
      </div>

      {members.length > 0 && (
        <div className="field">
          <label htmlFor="exp-person">Paid by</label>
          <select
            id="exp-person"
            className="input"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            <option value="">Nobody selected</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="exp-note">Note (optional)</label>
        <textarea
          id="exp-note"
          className="input"
          maxLength={500}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Receipt photos</label>
        <div className="photo-picker">
          <label>
            <IconCamera />
            Add photos
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              hidden
              onChange={(e) => pickFiles(e.target.files)}
            />
          </label>
          <div className="photo-grid">
            {existingPhotos
              .filter((p) => !removedIds.includes(p.id))
              .map((p) => (
                <div className="photo-cell" key={p.id}>
                  <img src={p.url} alt="" />
                  <button
                    type="button"
                    className="rm"
                    aria-label="Remove photo"
                    onClick={() => setRemovedIds((ids) => [...ids, p.id])}
                  >
                    ✕
                  </button>
                </div>
              ))}
            {previewUrls.map((url, i) => (
              <div className="photo-cell" key={url}>
                <img src={url} alt="" />
                <button
                  type="button"
                  className="rm"
                  aria-label="Remove photo"
                  onClick={() => {
                    URL.revokeObjectURL(url);
                    setNewFiles((fs) => fs.filter((_, idx) => idx !== i));
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {editing && (
          <button type="button" className="btn danger" style={{ flex: '0 0 auto', width: 54 }} onClick={remove} disabled={busy} aria-label="Delete expense">
            <IconTrash size={19} />
          </button>
        )}
        <button type="button" className="btn primary block" onClick={save} disabled={!valid || busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </Sheet>
  );
}
