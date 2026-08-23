import { useEffect, useState } from 'react';
import { IconTrash } from './icons';

export function PhotoLightbox({
  photos,
  index,
  onIndex,
  onDelete,
  onClose,
}: {
  photos: { id: string; url: string }[];
  index: number;
  onIndex: (i: number) => void;
  onDelete?: (photo: { id: string }) => void;
  onClose: () => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => setArmed(false), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lb-bar">
        <span className="small">
          {index + 1} / {photos.length}
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          {onDelete && (
            <button
              className="iconbtn"
              style={{ color: armed ? 'var(--bad)' : '#fff' }}
              aria-label="Delete photo"
              type="button"
              onClick={() => {
                if (armed) {
                  onDelete(photo);
                  onClose();
                } else {
                  setArmed(true);
                }
              }}
            >
              <IconTrash size={20} />
            </button>
          )}
          <button className="iconbtn" style={{ color: '#fff' }} aria-label="Close" type="button" onClick={onClose}>
            ✕
          </button>
        </span>
      </div>
      <img src={photo.url} alt="Receipt" />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 14px calc(14px + env(safe-area-inset-bottom))',
        }}
      >
        <button
          className="iconbtn"
          style={{ color: index === 0 ? 'transparent' : '#fff' }}
          disabled={index === 0}
          aria-label="Previous"
          type="button"
          onClick={() => onIndex(index - 1)}
        >
          ‹
        </button>
        <button
          className="iconbtn"
          style={{ color: index === photos.length - 1 ? 'transparent' : '#fff' }}
          disabled={index === photos.length - 1}
          aria-label="Next"
          type="button"
          onClick={() => onIndex(index + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
