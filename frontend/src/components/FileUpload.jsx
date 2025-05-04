import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import './FileUpload.css';

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);
  const [error, setError] = useState(null);
  const [useChunkedUpload, setUseChunkedUpload] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [multipleFilesMode, setMultipleFilesMode] = useState(true);
  const [compressFiles, setCompressFiles] = useState(false);
  const abortControllerRef = useRef(null);

  // Current file being processed
  const file = files[currentFileIndex] || null;

  // Overall progress across all files
  const [overallProgress, setOverallProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      // Reset any previous errors
      setError(null);

      // Store all dropped files
      setFiles(acceptedFiles);
      setCurrentFileIndex(0);
      setUploadResults([]);

      // Analyze the first file to determine upload method
      const firstFile = acceptedFiles[0];

      // Use regular upload for very small files, chunked upload for larger files
      // This ensures small files upload successfully
      const useChunks = firstFile.size > 2 * 1024 * 1024; // Only use chunks for files > 2MB
      setUseChunkedUpload(useChunks);

      if (useChunks) {
        // Dynamically determine chunk size based on file size
        let chunkSize = 5 * 1024 * 1024; // Default 5MB chunks
        if (firstFile.size > 100 * 1024 * 1024) { // For files > 100MB
          chunkSize = 10 * 1024 * 1024; // Use 10MB chunks
        } else if (firstFile.size < 20 * 1024 * 1024) { // For files < 20MB
          // For small files, use smaller chunks but ensure they're not too small
          // Minimum chunk size of 1MB to prevent excessive requests
          chunkSize = Math.max(1 * 1024 * 1024, Math.ceil(firstFile.size / 4));
        }

        const chunks = Math.ceil(firstFile.size / chunkSize);
        setTotalChunks(chunks);
        setCurrentChunk(0);
      }

      console.log(`Dropped ${acceptedFiles.length} files. First file: ${firstFile.name}, size: ${firstFile.size} bytes`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: multipleFilesMode // Use the state to control multiple file mode
  });

  // Effect to update overall progress when processing multiple files
  useEffect(() => {
    if (files.length > 0) {
      // Calculate overall progress across all files
      const filesCompleted = uploadResults.length;
      const currentFileContribution = files.length > filesCompleted ? (uploadProgress / 100) / files.length : 0;
      const newOverallProgress = ((filesCompleted / files.length) + currentFileContribution) * 100;
      setOverallProgress(Math.min(Math.round(newOverallProgress), 99)); // Cap at 99% until all complete
    }
  }, [files.length, uploadResults.length, uploadProgress]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Optimized regular upload for smaller files
  const handleRegularUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);

    // Add optimization hints to the request
    formData.append('optimized', 'true');

    // Add file size info to help server optimize handling
    formData.append('fileSize', file.size.toString());

    try {
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      console.log(`Starting regular upload for file: ${file.name}, size: ${file.size} bytes`);

      // Important: Do NOT set Content-Type header for multipart/form-data
      // Let the browser set it automatically with the correct boundary
      const response = await api.post('/api/upload', formData, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // Add this header for better server handling
          'Cache-Control': 'no-cache', // Prevent caching
        },
        signal,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
        // Add timeout to prevent hanging uploads
        timeout: 5 * 60 * 1000, // 5 minutes timeout
      });

      console.log('Upload successful:', response.data);

      // Add to results array
      setUploadResults(prev => [...prev, response.data]);

      // Process next file if in multiple files mode
      if (multipleFilesMode) {
        processNextFile();
      } else {
        setUploading(false);
      }
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        setError('Upload was cancelled');
      } else {
        console.error('Upload error:', err);
        // More detailed error message
        const errorMessage = err.response?.data?.error ||
                            (err.message || 'Failed to upload file. Please try again.');
        setError(errorMessage);
      }
      setUploading(false);
    }
  };

  // Chunked upload for larger files with parallel uploads
  const handleChunkedUpload = async () => {
    // Dynamically determine chunk size based on file size
    // Smaller chunks for smaller files, larger chunks for larger files
    let chunkSize = 5 * 1024 * 1024; // Default 5MB chunks
    if (file.size > 100 * 1024 * 1024) { // For files > 100MB
      chunkSize = 10 * 1024 * 1024; // Use 10MB chunks
    } else if (file.size < 20 * 1024 * 1024) { // For files < 20MB
      chunkSize = 2 * 1024 * 1024; // Use 2MB chunks
    }

    const chunks = Math.ceil(file.size / chunkSize);
    const uploadId = Date.now().toString();

    // Determine optimal number of concurrent uploads based on file size
    // More concurrent uploads for larger files, fewer for smaller files
    let concurrentUploads = 3; // Default
    if (file.size > 100 * 1024 * 1024) {
      concurrentUploads = 5; // More concurrent uploads for very large files
    } else if (file.size < 20 * 1024 * 1024) {
      concurrentUploads = 2; // Fewer concurrent uploads for smaller files
    }

    // Track uploaded chunks
    const uploadedChunks = new Set();
    const failedChunks = [];

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
        mimeType: file.type,
        chunkSize // Send chunk size to server
      }, { signal });

      // Step 2: Upload chunks in parallel
      const updateProgress = () => {
        const progress = (uploadedChunks.size / chunks) * 100;
        setUploadProgress(Math.min(Math.round(progress), 99)); // Cap at 99% until complete
      };

      // Function to upload a single chunk
      const uploadChunk = async (chunkIndex) => {
        if (signal.aborted) return;

        try {
          setCurrentChunk(chunkIndex);

          const start = chunkIndex * chunkSize;
          const end = Math.min(file.size, start + chunkSize);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', chunkIndex);

          // Important: Do NOT set Content-Type header for multipart/form-data
          // Let the browser set it automatically with the correct boundary
          await api.post('/api/upload/chunk', formData, {
            signal,
            // We'll handle progress separately for parallel uploads
            onUploadProgress: (progressEvent) => {
              // This progress is just for this chunk
              const chunkProgress = progressEvent.loaded / progressEvent.total;
              // We don't update the overall progress here to avoid UI jitter
            }
          });

          uploadedChunks.add(chunkIndex);
          updateProgress();

          return true;
        } catch (error) {
          if (!signal.aborted) {
            console.error(`Error uploading chunk ${chunkIndex}:`, error);
            failedChunks.push(chunkIndex);
          }
          return false;
        }
      };

      // Process chunks in batches
      for (let batchStart = 0; batchStart < chunks; batchStart += concurrentUploads) {
        if (signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const currentBatch = [];
        const end = Math.min(batchStart + concurrentUploads, chunks);

        for (let i = batchStart; i < end; i++) {
          currentBatch.push(uploadChunk(i));
        }

        // Wait for all chunks in this batch to complete
        await Promise.all(currentBatch);
      }

      // Retry failed chunks (up to 3 retries)
      if (failedChunks.length > 0 && !signal.aborted) {
        const maxRetries = 3;
        for (let retry = 0; retry < maxRetries && failedChunks.length > 0; retry++) {
          const chunksToRetry = [...failedChunks];
          failedChunks.length = 0; // Clear the array

          const retryPromises = chunksToRetry.map(chunkIndex => uploadChunk(chunkIndex));
          await Promise.all(retryPromises);
        }
      }

      // Check if all chunks were uploaded
      if (uploadedChunks.size !== chunks) {
        throw new Error(`Failed to upload all chunks. ${chunks - uploadedChunks.size} chunks missing.`);
      }

      // Step 3: Complete the upload
      const response = await api.post('/api/upload/complete', {
        uploadId,
        compress: compressFiles // Send compression flag to server
      }, { signal });

      setUploadProgress(100);

      // Add to results array
      setUploadResults(prev => [...prev, response.data]);

      // Process next file if in multiple files mode
      if (multipleFilesMode) {
        processNextFile();
      } else {
        setUploading(false);
      }
    } catch (err) {
      if (signal.aborted || err.message === 'Upload cancelled') {
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

  // Process the next file in the queue
  const processNextFile = () => {
    // Use setTimeout to prevent stack overflow with recursive calls
    // This also gives the UI a chance to update between files
    setTimeout(() => {
      // Move to the next file
      const nextIndex = currentFileIndex + 1;

      if (nextIndex < files.length) {
        // More files to process
        setCurrentFileIndex(nextIndex);
        setUploadProgress(0);

        // Determine upload method for the next file
        const nextFile = files[nextIndex];
        const useChunks = nextFile.size > 2 * 1024 * 1024;
        setUseChunkedUpload(useChunks);

        if (useChunks) {
          let chunkSize = 5 * 1024 * 1024;
          if (nextFile.size > 100 * 1024 * 1024) {
            chunkSize = 10 * 1024 * 1024;
          } else if (nextFile.size < 20 * 1024 * 1024) {
            chunkSize = Math.max(1 * 1024 * 1024, Math.ceil(nextFile.size / 4));
          }

          const chunks = Math.ceil(nextFile.size / chunkSize);
          setTotalChunks(chunks);
          setCurrentChunk(0);
        }

        // Start uploading the next file
        // We're using a new promise here to avoid recursive await calls
        const uploadPromise = useChunks ? handleChunkedUpload() : handleRegularUpload();

        uploadPromise.catch(err => {
          console.error(`Error uploading file ${nextIndex}:`, err);
          // Continue with next file despite error
          processNextFile();
        });
      } else {
        // All files processed
        setUploading(false);
        setOverallProgress(100);
      }
    }, 100); // Small delay to prevent UI freezing
  };

  // Main upload handler
  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setOverallProgress(0);
    setError(null);
    setUploadResults([]);
    setCurrentFileIndex(0);

    try {
      // Start with the first file
      if (useChunkedUpload) {
        await handleChunkedUpload();
      } else {
        await handleRegularUpload();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('An unexpected error occurred. Please try again.');
      setUploading(false);
    }
  };

  const handleReset = () => {
    // Cancel any ongoing upload
    if (uploading && abortControllerRef.current) {
      handleCancelUpload();
    }

    setFiles([]);
    setUploadResults([]);
    setError(null);
    setUploadProgress(0);
    setOverallProgress(0);
    setUseChunkedUpload(false);
    setCurrentChunk(0);
    setTotalChunks(0);
    setCurrentFileIndex(0);
  };

  return (
    <div className="file-upload">
      {uploadResults.length === 0 ? (
        <>
          <div className="upload-options">
            <div className="option-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={multipleFilesMode}
                  onChange={() => setMultipleFilesMode(!multipleFilesMode)}
                  disabled={uploading}
                />
                <span className="toggle-text">Multiple Files</span>
              </label>
            </div>

            <div className="option-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={compressFiles}
                  onChange={() => setCompressFiles(!compressFiles)}
                  disabled={uploading}
                />
                <span className="toggle-text">Compress Files</span>
                {compressFiles && <span className="toggle-info">🔍 Smaller file size, may reduce quality</span>}
              </label>
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''} ${files.length > 0 ? 'has-file' : ''}`}
          >
            <input {...getInputProps()} />
            {files.length > 0 ? (
              <div className="files-list">
                {files.length === 1 ? (
                  // Single file view
                  <div className="file-info">
                    <div className="file-icon">📄</div>
                    <div className="file-details">
                      <p className="file-name">{files[0].name}</p>
                      <p className="file-size">{formatFileSize(files[0].size)}</p>
                      {useChunkedUpload && (
                        <p className="upload-method">
                          Large file detected - will use chunked upload ({totalChunks} chunks)
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  // Multiple files view
                  <div className="files-summary">
                    <div className="files-icon">📚</div>
                    <div className="files-details">
                      <p className="files-count">{files.length} files selected</p>
                      <p className="files-size">
                        Total: {formatFileSize(files.reduce((total, file) => total + file.size, 0))}
                      </p>
                      <div className="files-preview">
                        {files.slice(0, 3).map((file, index) => (
                          <div key={index} className="file-preview-item">
                            <span className="file-preview-name">{file.name}</span>
                            <span className="file-preview-size">{formatFileSize(file.size)}</span>
                          </div>
                        ))}
                        {files.length > 3 && (
                          <div className="file-preview-more">
                            +{files.length - 3} more files
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="dropzone-content">
                <div className="upload-icon">📁</div>
                <p>Drag & drop {multipleFilesMode ? 'files' : 'a file'} here, or click to select</p>
                {multipleFilesMode && <p className="dropzone-hint">You can select multiple files</p>}
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="upload-actions">
              <button
                className="upload-button"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : `Upload ${files.length > 1 ? `${files.length} Files` : 'File'}`}
              </button>
              <button
                className="reset-button"
                onClick={handleReset}
                disabled={uploading}
              >
                Reset
              </button>
              {compressFiles && (
                <div className="compression-badge">
                  <span>🗜️ Compression ON</span>
                </div>
              )}
            </div>
          )}

          {uploading && (
            <div className="upload-progress">
              {files.length > 1 && (
                <div className="overall-progress">
                  <h3>Overall Progress</h3>
                  <div className="progress-bar overall">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${overallProgress}%` }}
                    ></div>
                  </div>
                  <div className="progress-info">
                    <p>{overallProgress}% overall ({currentFileIndex + 1} of {files.length} files)</p>
                  </div>
                </div>
              )}

              <div className="current-file-progress">
                {files.length > 1 && <h3>Current File: {file?.name}</h3>}
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
                  {compressFiles && <p className="compression-info">🗜️ Compression enabled</p>}
                  <button
                    className="cancel-button"
                    onClick={handleCancelUpload}
                  >
                    Cancel
                  </button>
                </div>
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
          {uploadResults.length === 1 ? (
            // Single file success view
            <>
              <h2>File Uploaded Successfully!</h2>
              <p>Your file <strong>{uploadResults[0].filename}</strong> has been uploaded.</p>
              <p>Share this code with others to let them download your file:</p>
              <div className="file-code">{uploadResults[0].code}</div>
              <div className="success-actions">
                <button className="copy-button" onClick={() => {
                  navigator.clipboard.writeText(uploadResults[0].code);
                  alert('Code copied to clipboard!');
                }}>
                  Copy Code
                </button>
                <button className="new-upload-button" onClick={handleReset}>
                  Upload Another File
                </button>
              </div>
            </>
          ) : (
            // Multiple files success view
            <>
              <h2>Files Uploaded Successfully!</h2>
              <p><strong>{uploadResults.length} files</strong> have been uploaded.</p>
              <div className="files-codes-list">
                {uploadResults.map((result, index) => (
                  <div key={index} className="file-code-item">
                    <div className="file-code-name">{result.filename}</div>
                    <div className="file-code-value">{result.code}</div>
                    <button className="copy-code-button" onClick={() => {
                      navigator.clipboard.writeText(result.code);
                      alert(`Code for ${result.filename} copied to clipboard!`);
                    }}>
                      Copy
                    </button>
                  </div>
                ))}
              </div>
              <div className="success-actions">
                <button className="new-upload-button" onClick={handleReset}>
                  Upload More Files
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
