import { useState } from 'react';
import './ControlPanel.css';

const VIEWS = [
  { id: 'aerial', label: 'Aerial' },
  { id: 'front', label: 'Front entrance' },
  { id: 'stairs', label: 'Front stairs' },
  { id: 'landing', label: 'Top of stairs' },
  { id: 'right', label: 'Right side' },
  { id: 'back', label: 'Back side' },
  { id: 'left', label: 'Left side' },
  { id: 'top', label: 'Plan view' },
];

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg__btn ${value === o.value ? 'is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ControlPanel({ activeView, onView, night, onNight, wallStyle, onWallStyle, labels, onLabels, embedded = false }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`panel ${embedded ? 'panel--embedded' : ''} ${open || embedded ? '' : 'panel--closed'}`} aria-label="Model controls">
      {!embedded && (
        <button type="button" className="panel__handle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide controls' : 'Controls'}
        </button>
      )}
      <div className="panel__body">
        <div className="panel__group">
          <h2 className="panel__heading">Camera</h2>
          <div className="views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`chip ${activeView === v.id ? 'is-on' : ''}`}
                onClick={() => onView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel__group">
          <h2 className="panel__heading">Lighting</h2>
          <Segmented
            label="Time of day"
            value={night ? 'night' : 'day'}
            onChange={(v) => onNight(v === 'night')}
            options={[{ value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]}
          />
        </div>

        <div className="panel__group">
          <h2 className="panel__heading">Ground floor finish</h2>
          <Segmented
            label="Ground floor finish"
            value={wallStyle}
            onChange={onWallStyle}
            options={[{ value: 'brick', label: 'Exposed brick' }, { value: 'plaster', label: 'Plastered' }]}
          />
        </div>

        <div className="panel__group panel__group--row">
          <div>
            <h2 className="panel__heading">Pillar labels</h2>
            <p className="panel__note">A01 to A06 and B01 to B06, as on the drawing</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={labels}
            aria-label="Show pillar labels"
            className={`switch ${labels ? 'is-on' : ''}`}
            onClick={() => onLabels(!labels)}
          >
            <span className="switch__knob" />
          </button>
        </div>
      </div>
    </section>
  );
}