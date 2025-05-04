import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';
import './pages/Pages.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/download" element={<DownloadPage />} />
          </Routes>
        </main>
        <footer className="footer">
          <div className="container">
            <p>&copy; {new Date().getFullYear()} FileShare. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
