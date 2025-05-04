import { useState } from 'react';
import api from '../utils/api';
import './FileDownload.css';

const FileDownload = () => {
  const [code, setCode] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleCodeChange = (e) => {
    setCode(e.target.value.trim());
    setError(null);
  };

  const handleCheckFile = async (e) => {
    e.preventDefault();

    if (!code) {
      setError('Please enter a file code');
      return;
    }

    setLoading(true);
    setError(null);
    setFileInfo(null);

    try {
      const response = await api.get(`/api/download/${code}`);
      setFileInfo(response.data);
    } catch (err) {
      console.error('Error checking file:', err);
      setError(err.response?.data?.error || 'Failed to find file. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloadStarted(true);

    try {
      // Create a link to download the file
      const link = document.createElement('a');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      link.href = `${apiUrl}/api/file/${code}`;
      link.setAttribute('download', fileInfo.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download file. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleReset = () => {
    setCode('');
    setFileInfo(null);
    setError(null);
    setDownloadStarted(false);
  };

  return (
    <div className="file-download">
      {!fileInfo ? (
        <form onSubmit={handleCheckFile} className="download-form">
          <h2>Download a File</h2>
          <p className="form-description">Enter the file code you received to download the file.</p>

          <div className="input-group">
            <label htmlFor="file-code">File Code</label>
            <input
              type="text"
              id="file-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="Enter file code (e.g., ABC123)"
              className="code-input"
            />
          </div>

          <button
            type="submit"
            className="check-button"
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Check File'}
          </button>

          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
            </div>
          )}
        </form>
      ) : (
        <div className="file-info-card">
          <div className="file-icon">📄</div>
          <h2>File Found!</h2>

          <div className="file-details">
            <div className="detail-row">
              <span className="detail-label">Filename:</span>
              <span className="detail-value">{fileInfo.filename}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Size:</span>
              <span className="detail-value">
                {formatFileSize(fileInfo.size)}
                {fileInfo.compressed && fileInfo.originalSize && (
                  <span className="compressed-info">
                    (Original: {formatFileSize(fileInfo.originalSize)})
                  </span>
                )}
              </span>
            </div>
            {fileInfo.compressed && fileInfo.compressionRatio && (
              <div className="detail-row compression-row">
                <span className="detail-label">Compression:</span>
                <span className="detail-value">
                  <span className="compression-badge">
                    🗜️ {fileInfo.compressionRatio}x smaller
                  </span>
                </span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Uploaded:</span>
              <span className="detail-value">{formatDate(fileInfo.uploadDate)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Code:</span>
              <span className="detail-value file-code">{code}</span>
            </div>
          </div>

          <div className="download-actions">
            <button
              className="download-button"
              onClick={handleDownload}
              disabled={downloadStarted}
            >
              {downloadStarted ? 'Downloading...' : 'Download File'}
            </button>
            <button className="back-button" onClick={handleReset}>
              Back to Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDownload;
