import { useCallback, useState } from 'react';
import Scene3D from './components/Scene3D.jsx';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import SpecsCard from './components/SpecsCard.jsx';
import ActionBar from './components/ActionBar.jsx';
import Loader from './components/Loader.jsx';
import './App.css';

export default function App() {
  const [view, setView] = useState({ id: 'aerial', nonce: 0 });
  const [night, setNight] = useState(false);
  const [wallStyle, setWallStyle] = useState('brick');
  const [labels, setLabels] = useState(true);
  const [interior, setInterior] = useState(false);
  const [ready, setReady] = useState(false);

  // 'in:*' views building ke andar, baaki bahar
  const goTo = useCallback((id) => {
    setInterior(id.startsWith('in:'));
    setView((v) => ({ id, nonce: v.nonce + 1 }));
  }, []);
  const enter = useCallback(() => goTo('in:ground'), [goTo]);
  const exit = useCallback(() => goTo('front'), [goTo]);

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

      <Loader visible={!ready} />
    </div>
  );
}
