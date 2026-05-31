import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Host from '@/pages/Host';
import Viewer from '@/pages/Viewer';
import Playback from '@/pages/Playback';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Host />} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/playback" element={<Playback />} />
      </Routes>
    </Router>
  );
}
