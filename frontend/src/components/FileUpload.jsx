import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import './FileUpload.css';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false
  });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setUploadResult(response.data);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="file-upload">
      {!uploadResult ? (
        <>
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="file-info">
                <div className="file-icon">📄</div>
                <div className="file-details">
                  <p className="file-name">{file.name}</p>
                  <p className="file-size">{formatFileSize(file.size)}</p>
                </div>
              </div>
            ) : (
              <div className="dropzone-content">
                <div className="upload-icon">📁</div>
                <p>Drag & drop a file here, or click to select</p>
              </div>
            )}
          </div>

          {file && (
            <div className="upload-actions">
              <button
                className="upload-button"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <button
                className="reset-button"
                onClick={handleReset}
                disabled={uploading}
              >
                Reset
              </button>
            </div>
          )}

          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p>{uploadProgress}% uploaded</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
            </div>
          )}
        </>
      ) : (
        <div className="upload-success">
          <div className="success-icon">✅</div>
          <h2>File Uploaded Successfully!</h2>
          <p>Your file <strong>{uploadResult.filename}</strong> has been uploaded.</p>
          <p>Share this code with others to let them download your file:</p>
          <div className="file-code">{uploadResult.code}</div>
          <div className="success-actions">
            <button className="copy-button" onClick={() => {
              navigator.clipboard.writeText(uploadResult.code);
              alert('Code copied to clipboard!');
            }}>
              Copy Code
            </button>
            <button className="new-upload-button" onClick={handleReset}>
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
