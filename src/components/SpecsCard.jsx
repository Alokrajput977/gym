import './SpecsCard.css';

const ROWS = [
  ['Back side', '60′'],
  ['Front side (entrance)', '76′'],
  ['Left side', '101′-6″'],
  ['Right side', '106′-11.8″'],
  ['Pillars', '6 left, 6 right'],
  ['Height', '3 floors, 10.8 m'],
];

export default function SpecsCard() {
  return (
    <aside className="specs" aria-label="Drawing dimensions">
      <h2 className="specs__title">From the drawing</h2>
      <dl className="specs__list">
        {ROWS.map(([k, v]) => (
          <div className="specs__row" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
