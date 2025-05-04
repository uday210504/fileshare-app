import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import './FileUpload.css';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [useChunkedUpload, setUseChunkedUpload] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const abortControllerRef = useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setError(null);

      // Automatically use chunked upload for files larger than 10MB
      const useChunks = selectedFile.size > 10 * 1024 * 1024;
      setUseChunkedUpload(useChunks);

      if (useChunks) {
        // Calculate number of chunks (5MB per chunk)
        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
        const chunks = Math.ceil(selectedFile.size / chunkSize);
        setTotalChunks(chunks);
        setCurrentChunk(0);
      }
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

  // Regular upload for smaller files
  const handleRegularUpload = async () => {
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
      setUploading(false);
    }
  };

  // Chunked upload for larger files
  const handleChunkedUpload = async () => {
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const chunks = Math.ceil(file.size / chunkSize);
    const uploadId = Date.now().toString();

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Step 1: Initialize the upload
      await api.post('/api/upload/init', {
        uploadId,
        filename: file.name,
        totalChunks: chunks,
        fileSize: file.size,
        mimeType: file.type
      }, { signal });

      // Step 2: Upload each chunk
      for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
        // Check if upload was cancelled
        if (signal.aborted) {
          throw new Error('Upload cancelled');
        }

        setCurrentChunk(chunkIndex);

        const start = chunkIndex * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex);

        await api.post('/api/upload/chunk', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            // Calculate overall progress considering both the current chunk and previously uploaded chunks
            const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
            const overallProgress = ((chunkIndex / chunks) * 100) + (chunkProgress / chunks);
            setUploadProgress(Math.min(Math.round(overallProgress), 99)); // Cap at 99% until complete
          },
          signal
        });
      }

      // Step 3: Complete the upload
      const response = await api.post('/api/upload/complete', { uploadId }, { signal });
      setUploadProgress(100);
      setUploadResult(response.data);
    } catch (err) {
      if (err.message === 'Upload cancelled') {
        setError('Upload was cancelled');
      } else {
        console.error('Chunked upload error:', err);
        setError(err.response?.data?.error || 'Failed to upload file. Please try again.');
      }
      setUploading(false);
    }
  };

  // Cancel the ongoing upload
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Main upload handler
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    try {
      if (useChunkedUpload) {
        await handleChunkedUpload();
      } else {
        await handleRegularUpload();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    // Cancel any ongoing upload
    if (uploading && abortControllerRef.current) {
      handleCancelUpload();
    }

    setFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
    setUseChunkedUpload(false);
    setCurrentChunk(0);
    setTotalChunks(0);
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
                  {useChunkedUpload && (
                    <p className="upload-method">
                      Large file detected - will use chunked upload ({totalChunks} chunks)
                    </p>
                  )}
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
              <div className="progress-info">
                <p>{uploadProgress}% uploaded</p>
                {useChunkedUpload && (
                  <p className="chunk-info">
                    Chunk {currentChunk + 1} of {totalChunks}
                  </p>
                )}
                <button
                  className="cancel-button"
                  onClick={handleCancelUpload}
                >
                  Cancel
                </button>
              </div>
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
