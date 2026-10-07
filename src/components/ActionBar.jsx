import './ActionBar.css';

const INSIDE_VIEWS = [
  { id: 'in:ground', label: 'Ground floor' },
  { id: 'in:reception', label: 'Reception' },
  { id: 'in:spring', label: 'Spring floor' },
  { id: 'in:pit', label: 'Foam pit' },
  { id: 'in:equipment', label: 'Equipment' },
  { id: 'in:balcony', label: 'Balcony' },
  { id: 'in:room1', label: 'Room 1' },
  { id: 'in:room2', label: 'Room 2' },
  { id: 'in:left', label: 'Left wall art' },
  { id: 'in:right', label: 'Right wall art' },
];

function DoorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h8A1.5 1.5 0 0 1 16 4.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="13" cy="12.5" r="1.2" fill="currentColor" />
      <path d="M19 9l2 3-2 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ActionBar({ interior, activeView, onEnter, onExit, onView }) {
  if (!interior) {
    return (
      <div className="actions">
        <button type="button" className="enter" onClick={onEnter}>
          <DoorIcon />
          Enter building
        </button>
        <p className="actions__hint">Drag to orbit, scroll to zoom, or click the building</p>
      </div>
    );
  }
  return (
    <div className="actions actions--inside">
      <div className="inside-bar">
        <div className="inside-bar__chips" role="group" aria-label="Inside views">
          {INSIDE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`inside-chip ${activeView === v.id ? 'is-on' : ''}`}
              onClick={() => onView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button type="button" className="exit" onClick={onExit}>
          Exit building
        </button>
      </div>
      <p className="actions__hint">Drag to look around. Scroll or W A S D to walk, Q and E to go down or up.</p>
    </div>
  );
}