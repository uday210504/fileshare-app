import { useState } from 'react';
import api from '../utils/api';
import './FileDownload.css';

const FileDownload = () => {
  const [code, setCode] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadStarted, setDownloadStarted] = useState({});
  const [activeDownloads, setActiveDownloads] = useState(0);

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
    setGroupInfo(null);

    try {
      // First try to get file info
      try {
        const response = await api.get(`/api/download/${code}`);
        setFileInfo(response.data);
        setGroupInfo(null);
      } catch (fileErr) {
        // If it's not a file, check if it's a group
        if (fileErr.response?.data?.isGroup) {
          // It's a group, get group info
          try {
            const groupResponse = await api.get(`/api/group/${code}`);
            setGroupInfo(groupResponse.data);
            setFileInfo(null);
          } catch (groupErr) {
            throw groupErr;
          }
        } else {
          // It's neither a valid file nor a group
          throw fileErr;
        }
      }
    } catch (err) {
      console.error('Error checking code:', err);
      setError(err.response?.data?.error || 'Failed to find file or group. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    // Use the provided fileId or the current code
    const downloadId = fileId || code;
    const downloadName = fileName || (fileInfo ? fileInfo.filename : 'file');

    // Mark this file as downloading
    setDownloadStarted(prev => ({ ...prev, [downloadId]: true }));
    setActiveDownloads(prev => prev + 1);

    try {
      // Create a link to download the file
      const link = document.createElement('a');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      link.href = `${apiUrl}/api/file/${downloadId}`;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      setError(`Failed to download ${downloadName}. Please try again.`);
    } finally {
      // Reduce active downloads count
      setTimeout(() => {
        setActiveDownloads(prev => Math.max(0, prev - 1));
      }, 1000);
    }
  };

  const handleDownloadAll = async () => {
    if (!groupInfo || !groupInfo.files || groupInfo.files.length === 0) {
      setError('No files to download');
      return;
    }

    // Download files one by one with a small delay to prevent browser blocking
    for (let i = 0; i < groupInfo.files.length; i++) {
      const file = groupInfo.files[i];
      await handleDownload(file.id, file.filename);

      // Small delay between downloads to prevent browser blocking
      if (i < groupInfo.files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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
    setGroupInfo(null);
    setError(null);
    setDownloadStarted({});
    setActiveDownloads(0);
  };

  // Determine if we're showing the input form or a result
  const showInputForm = !fileInfo && !groupInfo;

  return (
    <div className="file-download">
      {showInputForm ? (
        <form onSubmit={handleCheckFile} className="download-form">
          <h2>Download Files</h2>
          <p className="form-description">Enter the file code or group code you received to download the file(s).</p>

          <div className="input-group">
            <label htmlFor="file-code">File Code</label>
            <input
              type="text"
              id="file-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="Enter code (e.g., ABC123)"
              className="code-input"
            />
          </div>

          <button
            type="submit"
            className="check-button"
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Check Code'}
          </button>

          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
            </div>
          )}
        </form>
      ) : fileInfo ? (
        // Single file view
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
              onClick={() => handleDownload()}
              disabled={downloadStarted[code]}
            >
              {downloadStarted[code] ? 'Downloading...' : 'Download File'}
            </button>
            <button className="back-button" onClick={handleReset}>
              Back to Search
            </button>
          </div>
        </div>
      ) : groupInfo ? (
        // Group view
        <div className="file-info-card group-info-card">
          <div className="file-icon">📦</div>
          <h2>File Group Found!</h2>

          <div className="file-details">
            <div className="detail-row">
              <span className="detail-label">Group Name:</span>
              <span className="detail-value">{groupInfo.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Files:</span>
              <span className="detail-value">{groupInfo.fileCount} files</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created:</span>
              <span className="detail-value">{formatDate(groupInfo.createdAt)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Group Code:</span>
              <span className="detail-value file-code">{code}</span>
            </div>
          </div>

          {/* List of files in the group */}
          <div className="group-files-list">
            <h3>Files in this group:</h3>
            {groupInfo.files && groupInfo.files.length > 0 ? (
              <ul className="files-list">
                {groupInfo.files.map((file, index) => (
                  <li key={file.id} className="file-item">
                    <div className="file-item-info">
                      <span className="file-item-name">{file.filename}</span>
                      <span className="file-item-size">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      className="file-download-button"
                      onClick={() => handleDownload(file.id, file.filename)}
                      disabled={downloadStarted[file.id]}
                    >
                      {downloadStarted[file.id] ? 'Downloading...' : 'Download'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-files-message">No files found in this group.</p>
            )}
          </div>

          <div className="download-actions">
            <button
              className="download-button"
              onClick={handleDownloadAll}
              disabled={activeDownloads > 0 || !groupInfo.files || groupInfo.files.length === 0}
            >
              {activeDownloads > 0 ? `Downloading (${activeDownloads}/${groupInfo.files.length})...` : 'Download All Files'}
            </button>
            <button className="back-button" onClick={handleReset}>
              Back to Search
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FileDownload;
