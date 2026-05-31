import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TaskDetail from './pages/TaskDetail';
import TaskList from './pages/TaskList';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tasks" element={<TaskList />} />
        <Route path="/task/:taskId" element={<TaskDetail />} />
      </Routes>
    </Router>
  );
};

export default App;
