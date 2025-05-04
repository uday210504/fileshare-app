import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo">
          <h1>FileShare</h1>
        </Link>
        <nav className="nav">
          <ul>
            <li>
              <Link to="/" className="nav-link">Upload</Link>
            </li>
            <li>
              <Link to="/download" className="nav-link">Download</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
