import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { IntakePage } from './pages/IntakePage';
import { DashboardPage } from './pages/DashboardPage';
import { NoteReviewPage } from './pages/NoteReviewPage';
import { PatientChartPage } from './pages/PatientChartPage';
import { RecordsPage } from './pages/RecordsPage';
import { MedCardPage } from './pages/MedCardPage';
import { TimelinePage } from './pages/TimelinePage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/note/:noteId" element={<NoteReviewPage />} />
        <Route path="/dashboard/patient/:patientId" element={<PatientChartPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/medcard" element={<MedCardPage />} />
        <Route path="/med-card" element={<Navigate to="/medcard" replace />} />
        <Route path="/timeline" element={<TimelinePage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
