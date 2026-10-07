import { useCallback, useEffect, useState } from 'react';
import Scene3D from './components/Scene3D.jsx';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import SpecsCard from './components/SpecsCard.jsx';
import ActionBar, { INSIDE_VIEWS } from './components/ActionBar.jsx';
import MobileMenu from './components/MobileMenu.jsx';
import Loader from './components/Loader.jsx';
import './App.css';

const MOBILE_QUERY = '(max-width: 900px)';

/** Phone / chhoti screen hai ya nahi (rotate karne par bhi update). */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export default function App() {
  const isMobile = useIsMobile();
  const [view, setView] = useState({ id: 'aerial', nonce: 0 });
  const [night, setNight] = useState(false);
  const [wallStyle, setWallStyle] = useState('brick');
  // Phone par pillar labels shuru mein band (screen saaf rahe) – menu se on kar sakte hain
  const [labels, setLabels] = useState(() => !window.matchMedia(MOBILE_QUERY).matches);
  const [interior, setInterior] = useState(false);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 'in:*' views building ke andar, baaki bahar
  const goTo = useCallback((id) => {
    setInterior(id.startsWith('in:'));
    setView((v) => ({ id, nonce: v.nonce + 1 }));
  }, []);
  const enter = useCallback(() => goTo('in:ground'), [goTo]);
  const exit = useCallback(() => goTo('front'), [goTo]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Menu se camera view chuno to menu band ho jaaye (scene dikhe)
  const goToFromMenu = useCallback(
    (id) => {
      goTo(id);
      setMenuOpen(false);
    },
    [goTo],
  );

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  return (
    <div className="app">
      <Scene3D
        view={view}
        night={night}
        wallStyle={wallStyle}
        labels={labels}
        interior={interior}
        onBuildingClick={enter}
        onReady={() => setReady(true)}
      />

      {isMobile ? (
        <>
          <MobileMenu open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={closeMenu}>
            {interior ? (
              <>
                <h2 className="drawer__label">Inside views</h2>
                <div className="drawer__views">
                  {INSIDE_VIEWS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`chip ${view.id === v.id ? 'is-on' : ''}`}
                      onClick={() => goToFromMenu(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <ControlPanel
                embedded
                activeView={view.id}
                onView={goToFromMenu}
                night={night}
                onNight={setNight}
                wallStyle={wallStyle}
                onWallStyle={setWallStyle}
                labels={labels}
                onLabels={setLabels}
              />
            )}
          </MobileMenu>
          {!menuOpen && <ActionBar compact interior={interior} onEnter={enter} onExit={exit} />}
        </>
      ) : (
        <>
          <Header />
          {!interior && (
            <ControlPanel
              activeView={view.id}
              onView={goTo}
              night={night}
              onNight={setNight}
              wallStyle={wallStyle}
              onWallStyle={setWallStyle}
              labels={labels}
              onLabels={setLabels}
            />
          )}
          {!interior && <SpecsCard />}
          <ActionBar interior={interior} activeView={view.id} onEnter={enter} onExit={exit} onView={goTo} />
        </>
      )}

      <Loader visible={!ready} />
    </div>
  );
}