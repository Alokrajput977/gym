import './Header.css';

export default function Header() {
  return (
    <header className="board">
      <span className="board__stripe" aria-hidden="true" />
      <div className="board__body">
        <h1 className="board__title">Gymnastics Academy</h1>
        <p className="board__sub">Training warehouse, three floors on a 60′ to 76′ plot</p>
      </div>
    </header>
  );
}
