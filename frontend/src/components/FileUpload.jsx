import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import './FileUpload.css';

// Helper function to create a file group
const createFileGroup = async (fileIds, groupName) => {
  try {
    // Validate input
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error('No file IDs provided for group creation');
    }

    // Log the request for debugging
    console.log(`Sending group creation request with ${fileIds.length} files:`, {
      fileIds,
      groupName: groupName || '(unnamed group)'
    });

    // Make the API call with a timeout
    const response = await api.post('/api/group', {
      fileIds,
      groupName
    }, {
      timeout: 10000 // 10 second timeout for group creation
    });

    // Validate the response
    if (!response || !response.data || !response.data.groupCode) {
      throw new Error('Invalid response from server when creating group');
    }

    console.log('Group creation response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating file group:', error);
    throw error;
  }
};

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
  const [createGroup, setCreateGroup] = useState(true); // Default to creating a group for multiple files
  const [groupInfo, setGroupInfo] = useState(null); // Store group info when created
  const [groupName, setGroupName] = useState(''); // Optional group name
  const abortControllerRef = useRef(null);
  const processingRef = useRef(false); // Track if we're currently processing a file

  // Overall progress across all files
  const [overallProgress, setOverallProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      // If already uploading, don't allow new files
      if (uploading) {
        console.log('Upload in progress, cannot add new files');
        return;
      }

      // Reset any previous errors
      setError(null);

      // Make a copy of the files array to ensure we're working with a stable array
      const filesArray = [...acceptedFiles];

      // Filter out any invalid files (zero size or undefined)
      const validFiles = filesArray.filter(file => file && file.size > 0);

      if (validFiles.length === 0) {
        setError('No valid files selected. Files may be empty or corrupted.');
        return;
      }

      // Store all valid dropped files
      setFiles(validFiles);
      setCurrentFileIndex(0);
      setUploadResults([]);
      setUploadProgress(0);
      setOverallProgress(0);

      // Log the files being processed
      console.log(`Dropped ${validFiles.length} valid files:`);
      validFiles.forEach((file, index) => {
        console.log(`File ${index + 1}: ${file.name}, size: ${formatFileSize(file.size)}, type: ${file.type}`);
      });

      // Analyze the first file to determine initial upload method
      const firstFile = validFiles[0];

      // Use regular upload for very small files, chunked upload for larger files
      const useChunks = firstFile.size > 2 * 1024 * 1024; // Only use chunks for files > 2MB
      setUseChunkedUpload(useChunks);

      if (useChunks) {
        // Dynamically determine chunk size based on file size
        let chunkSize = 5 * 1024 * 1024; // Default 5MB chunks
        if (firstFile.size > 100 * 1024 * 1024) { // For files > 100MB
          chunkSize = 10 * 1024 * 1024; // Use 10MB chunks
        } else if (firstFile.size < 20 * 1024 * 1024) { // For files < 20MB
          // For small files, use smaller chunks but ensure they're not too small
          chunkSize = Math.max(1 * 1024 * 1024, Math.ceil(firstFile.size / 4));
        }

        const chunks = Math.ceil(firstFile.size / chunkSize);
        setTotalChunks(chunks);
        setCurrentChunk(0);
      }
    }
  }, [uploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: multipleFilesMode // Use the state to control multiple file mode
  });

  // Helper function to calculate overall progress
  const calculateOverallProgress = (currentIndex, totalFiles, currentProgress) => {
    // Calculate completed files contribution
    const completedContribution = (currentIndex / totalFiles) * 100;

    // Calculate current file contribution
    const currentContribution = (currentProgress / 100) * (1 / totalFiles) * 100;

    // Sum both contributions
    return completedContribution + currentContribution;
  };

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
  const handleRegularUpload = async (fileToUpload, fileIndex) => {
    try {
      // Get a direct reference to the file to avoid state closure issues
      const currentFile = fileToUpload;
      const currentIndex = fileIndex;
      
      // Validate file before uploading
      if (!currentFile || currentFile.size === 0) {
        console.error(`Invalid file at index ${currentIndex}`);
        setError('Invalid file. Please select a valid file.');
        return null;
      }

      // Create a new FormData instance for this file
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('optimized', compressFiles ? 'true' : 'false');
      formData.append('fileSize', currentFile.size.toString());

      // Create abort controller for cancellation
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const signal = abortControllerRef.current.signal;

      console.log(`Starting upload for file: ${currentFile.name}, size: ${formatFileSize(currentFile.size)}`);

      const response = await api.post('/api/upload', formData, {
        signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            
            // Update overall progress
            const overallPercent = calculateOverallProgress(
              currentIndex,
              files.length,
              percentCompleted
            );
            setOverallProgress(Math.min(Math.round(overallPercent), 99));
          } else {
            setUploadProgress(50); // Show some progress
          }
        },
        timeout: 5 * 60 * 1000, // 5 minutes timeout
      });

      // Check if the response is valid
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      console.log(`Upload successful for ${currentFile.name}:`, response.data);

      // Important: Add the file to results array with original file information
      await new Promise(resolve => {
        setUploadResults(prev => {
          // Check if this file is already in the results
          const isDuplicate = prev.some(item => 
            (response.data.uniqueIdentifier && item.uniqueIdentifier === response.data.uniqueIdentifier) ||
            item.code === response.data.code
          );

          if (isDuplicate) {
            console.log(`Skipping duplicate result for ${currentFile.name}`);
            setTimeout(() => resolve(), 0);
            return prev;
          }

          // Add enhanced result with the original file information
          const enhancedResult = {
            ...response.data,
            originalFilename: currentFile.name,
            originalSize: currentFile.size,
            uploadTime: new Date().toISOString()
          };
          
          const newResults = [...prev, enhancedResult];
          console.log(`Updated upload results: ${newResults.length} files`);
          setTimeout(() => resolve(), 0);
          return newResults;
        });
      });

      setUploadProgress(100);
      return response.data;
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        setError('Upload was cancelled');
        return null;
      }

      console.error(`Upload error:`, err);
      setError(err.message || 'Failed to upload file. Please try again.');
      return null;
    }
  };

  // Chunked upload for larger files
  const handleChunkedUpload = async (fileToUpload, fileIndex) => {
    try {
      // Get a direct reference to the file
      const file = fileToUpload;
      const currentIndex = fileIndex;
      
      if (!file || file.size === 0) {
        console.error(`Invalid file at index ${currentIndex}`);
        setError('Invalid file. Please select a valid file.');
        return null;
      }

      console.log(`Starting chunked upload for: ${file.name}`);

      // Determine chunk size
      let chunkSize = 5 * 1024 * 1024; // Default 5MB
      if (file.size > 100 * 1024 * 1024) {
        chunkSize = 10 * 1024 * 1024; // 10MB for large files
      } else if (file.size < 20 * 1024 * 1024) {
        chunkSize = Math.max(1 * 1024 * 1024, Math.ceil(file.size / 4));
      }

      const chunks = Math.ceil(file.size / chunkSize);
      const uploadId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 10);
      const concurrentUploads = file.size > 100 * 1024 * 1024 ? 3 : 2;

      // Track upload progress
      const uploadedChunks = new Set();
      const failedChunks = [];

      // Create abort controller
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      console.log(`Starting chunked upload: ${chunks} chunks, ${concurrentUploads} concurrent uploads`);
      
      // Initialize upload
      await api.post('/api/upload/init', {
        uploadId,
        filename: file.name,
        totalChunks: chunks,
        fileSize: file.size,
        mimeType: file.type,
        chunkSize
      }, { signal });

      // Function to update progress
      const updateProgress = () => {
        const progress = (uploadedChunks.size / chunks) * 100;
        setUploadProgress(Math.min(Math.round(progress), 99));
        
        // Update overall progress
        const overallPercent = calculateOverallProgress(
          currentIndex,
          files.length,
          progress
        );
        setOverallProgress(Math.min(Math.round(overallPercent), 99));
      };

      // Function to upload a single chunk
      const uploadChunk = async (chunkIndex) => {
        if (signal.aborted) return false;

        setCurrentChunk(chunkIndex);
        
        const start = chunkIndex * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end);

        if (!chunk || chunk.size === 0) {
          console.error(`Invalid chunk at index ${chunkIndex}`);
          failedChunks.push(chunkIndex);
          return false;
        }

        const formData = new FormData();
        formData.append('chunk', chunk, 'chunk');
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex);

        // Add retry mechanism
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries) {
          try {
            await api.post('/api/upload/chunk', formData, {
              signal,
              timeout: 60000 // 1 minute timeout per chunk
            });
            
            // Success
            break;
          } catch (err) {
            retries++;
            
            if (retries > maxRetries || signal.aborted) {
              throw err;
            }
            
            // Wait and retry
            console.warn(`Retrying chunk ${chunkIndex} (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }

        uploadedChunks.add(chunkIndex);
        updateProgress();
        return true;
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

      // Retry failed chunks
      if (failedChunks.length > 0 && !signal.aborted) {
        for (let retry = 0; retry < 2 && failedChunks.length > 0; retry++) {
          const chunksToRetry = [...failedChunks];
          failedChunks.length = 0;
          
          const retryPromises = chunksToRetry.map(chunkIndex => uploadChunk(chunkIndex));
          await Promise.all(retryPromises);
        }
      }

      // Check if all chunks were uploaded
      if (uploadedChunks.size !== chunks) {
        throw new Error(`Failed to upload all chunks. ${chunks - uploadedChunks.size} chunks missing.`);
      }

      // Complete the upload
      const response = await api.post('/api/upload/complete', {
        uploadId,
        compress: compressFiles
      }, { signal });

      setUploadProgress(100);

      // Check response
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      console.log(`Chunked upload successful for ${file.name}:`, response.data);

      // Add to results
      await new Promise(resolve => {
        setUploadResults(prev => {
          // Check for duplicates
          const isDuplicate = prev.some(item =>
            (response.data.uniqueIdentifier && item.uniqueIdentifier === response.data.uniqueIdentifier) ||
            item.code === response.data.code
          );

          if (isDuplicate) {
            console.log(`Skipping duplicate result for ${file.name}`);
            setTimeout(() => resolve(), 0);
            return prev;
          }

          // Add enhanced result
          const enhancedResult = {
            ...response.data,
            originalFilename: file.name,
            originalSize: file.size,
            uploadTime: new Date().toISOString()
          };
          
          const newResults = [...prev, enhancedResult];
          console.log(`Updated upload results: ${newResults.length} files`);
          setTimeout(() => resolve(), 0);
          return newResults;
        });
      });

      return response.data;
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        setError('Upload was cancelled');
        return null;
      }

      console.error('Error in chunked upload:', err);
      setError(err.message || 'An unexpected error occurred during upload');
      return null;
    }
  }

  // Process the next file in the queue
  const processNextFile = () => {
    if (processingRef.current) {
      console.log('Already processing a file, ignoring duplicate call');
      return;
    }

    processingRef.current = true;

    setTimeout(() => {
      try {
        const nextIndex = currentFileIndex + 1;
        console.log(`Processing next file. Current index: ${currentFileIndex}, Next: ${nextIndex}, Total: ${files.length}`);

        if (nextIndex < files.length) {
          // Update the current file index
          setCurrentFileIndex(nextIndex);
          setUploadProgress(0);

          // Get a direct reference to the file
          const nextFile = files[nextIndex];

          if (!nextFile || nextFile.size === 0) {
            console.error(`Invalid or empty file at index ${nextIndex}`);
            processingRef.current = false;
            processNextFile(); // Skip and try next
            return;
          }

          console.log(`Processing: ${nextFile.name}, size: ${formatFileSize(nextFile.size)}`);
          
          // Reset errors
          setError(null);

          // Determine upload method
          const useChunks = nextFile.size > 2 * 1024 * 1024;
          
          // Create a new abort controller
          abortControllerRef.current = new AbortController();
          
          // Update UI state for chunked upload
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

          // Start upload with a slight delay to ensure state updates are applied
          setTimeout(() => {
            console.log(`Starting upload for: ${nextFile.name} (${useChunks ? 'chunked' : 'regular'})`);
            
            // Use the appropriate upload method with direct file reference
            const uploadPromise = useChunks
              ? handleChunkedUpload(nextFile, nextIndex)
              : handleRegularUpload(nextFile, nextIndex);
            
            uploadPromise
              .then(result => {
                console.log(`Upload completed for: ${nextFile.name}`);
                processingRef.current = false;
                
                // Continue to next file or finalize
                if (nextIndex + 1 < files.length) {
                  setTimeout(() => processNextFile(), 300);
                } else {
                  console.log(`All ${files.length} files processed`);
                  
                  // Create group if needed
                  setTimeout(() => {
                    if (createGroup && files.length > 1 && uploadResults.length > 1) {
                      handleCreateGroup();
                    } else {
                      setUploading(false);
                      setOverallProgress(100);
                    }
                  }, 300);
                }
              })
              .catch(err => {
                console.error(`Error uploading file: ${nextFile.name}:`, err);
                processingRef.current = false;
                
                // Try to continue with next file despite error
                if (nextIndex + 1 < files.length) {
                  setTimeout(() => processNextFile(), 300);
                } else {
                  // Check for group creation
                  setTimeout(() => {
                    if (createGroup && files.length > 1 && uploadResults.length > 1) {
                      handleCreateGroup();
                    } else {
                      setUploading(false);
                      setOverallProgress(100);
                    }
                  }, 300);
                }
              });
          }, 300);
        } else {
          // All files processed
          console.log(`All ${files.length} files processed`);
          
          // Create group if needed
          setTimeout(() => {
            if (createGroup && files.length > 1 && uploadResults.length > 1) {
              handleCreateGroup();
            } else {
              setUploading(false);
              setOverallProgress(100);
            }
            processingRef.current = false;
          }, 300);
        }
      } catch (error) {
        console.error('Error in processNextFile:', error);
        processingRef.current = false;
        setUploading(false);
      }
    }, 300);
  };

  // Main upload handler
  const handleUpload = async () => {
    if (processingRef.current) {
      console.log('Already processing files, ignoring duplicate request');
      return;
    }

    if (files.length === 0) {
      setError('Please select at least one file first');
      return;
    }

    // Reset all state
    setUploading(true);
    setUploadProgress(0);
    setOverallProgress(0);
    setError(null);
    setUploadResults([]);
    setCurrentFileIndex(0);
    setGroupInfo(null);
    processingRef.current = true;

    console.log(`Starting upload of ${files.length} files`);

    // Filter out invalid files
    const validFiles = files.filter(file => file && file.size > 0);

    if (validFiles.length === 0) {
      setError('No valid files to upload');
      setUploading(false);
      processingRef.current = false;
      return;
    }

    if (validFiles.length !== files.length) {
      console.warn(`Filtered out ${files.length - validFiles.length} invalid files`);
      setFiles(validFiles);
    }

    // Get the first file
    const firstFile = validFiles[0];
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Determine upload method for first file
    const useChunksForFirstFile = firstFile.size > 2 * 1024 * 1024;
    setUseChunkedUpload(useChunksForFirstFile);

    console.log(`Starting first file upload: ${firstFile.name}`);

    // Start upload with a slight delay to ensure state updates
    setTimeout(async () => {
      try {
        let result;
        
        // Use the appropriate upload method with direct file reference
        if (useChunksForFirstFile) {
          result = await handleChunkedUpload(firstFile, 0);
        } else {
          result = await handleRegularUpload(firstFile, 0);
        }

        // Process next file or finalize
        if (result && validFiles.length > 1) {
          processingRef.current = false;
          processNextFile();
        } else {
          processingRef.current = false;
          
          if (!result) {
            setUploading(false);
          } else if (validFiles.length === 1) {
            setOverallProgress(100);
            setUploading(false);
          }
        }
      } catch (err) {
        console.error('Upload error:', err);
        
        // Try to continue with next file in multiple file mode
        if (validFiles.length > 1) {
          processingRef.current = false;
          processNextFile();
        } else {
          processingRef.current = false;
          setUploading(false);
        }
      }
    }, 300);
  };

  // Separate function to handle group creation
  const handleCreateGroup = async () => {
    console.log('Creating file group...');

    try {
      // Get all file IDs from the upload results
      const fileIds = uploadResults.map(result => result.code);

      if (fileIds.length === 0) {
        console.error('No file IDs available to create group');
        setError('No files were successfully uploaded to create a group.');
        setUploading(false);
        return;
      }

      // Log the file IDs we're using to create the group
      console.log(`Creating group with ${fileIds.length} files:`, fileIds);
      console.log('Upload results:', uploadResults);

      // Make sure we have at least 2 files to create a group
      if (fileIds.length < 2) {
        console.warn('Not enough files to create a group, need at least 2');
        setError('Need at least 2 successfully uploaded files to create a group.');
        setUploading(false);
        return;
      }

      // Create the group with a retry mechanism
      let retries = 0;
      let groupResult = null;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          // Add a small delay before creating the group to ensure all files are properly saved on the server
          await new Promise(resolve => setTimeout(resolve, 500));

          groupResult = await createFileGroup(fileIds, groupName || undefined);
          console.log('Group created successfully:', groupResult);
          break; // Success, exit the retry loop
        } catch (err) {
          retries++;
          console.error(`Error creating group (attempt ${retries}/${maxRetries}):`, err);

          if (retries > maxRetries) {
            throw err; // Rethrow the error after all retries fail
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }

      if (!groupResult) {
        throw new Error('Failed to create group after multiple attempts');
      }

      // Store the group info
      setGroupInfo(groupResult);

      // Set overall progress to 100% to indicate completion
      setOverallProgress(100);
    } catch (error) {
      console.error('Failed to create group:', error);
      setError('Files were uploaded but failed to create group. You can still use individual file codes.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    // Cancel any ongoing upload
    if (uploading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset all state
    setFiles([]);
    setUploadResults([]);
    setError(null);
    setUploadProgress(0);
    setOverallProgress(0);
    setUseChunkedUpload(false);
    setCurrentChunk(0);
    setTotalChunks(0);
    setCurrentFileIndex(0);
    setGroupInfo(null);
    setGroupName('');

    // Reset processing flag
    processingRef.current = false;

    // Reset uploading state
    setUploading(false);

    console.log('Reset complete - all state cleared');
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
                  onChange={() => {
                    setMultipleFilesMode(!multipleFilesMode);
                    // If turning off multiple files mode, also turn off group creation
                    if (!multipleFilesMode === false) {
                      setCreateGroup(false);
                    }
                  }}
                  disabled={uploading}
                />
                <span className="toggle-text">Multiple Files</span>
              </label>
            </div>

            {multipleFilesMode && (
              <div className="option-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={createGroup}
                    onChange={() => setCreateGroup(!createGroup)}
                    disabled={uploading}
                  />
                  <span className="toggle-text">Create Group</span>
                  {createGroup && <span className="toggle-info">📦 All files share one code</span>}
                </label>
              </div>
            )}

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

            {multipleFilesMode && createGroup && (
              <div className="group-name-input">
                <input
                  type="text"
                  placeholder="Group Name (optional)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={uploading}
                  className="group-name-field"
                />
              </div>
            )}
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
                    <p>{Math.round(overallProgress)}% overall ({currentFileIndex + 1} of {files.length} files)</p>
                  </div>
                </div>
              )}

              <div className="current-file-progress">
                {files.length > 1 && (
                  <h3>Current File: {files[currentFileIndex]?.name || 'Processing...'}</h3>
                )}
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
                    onClick={() => {
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        abortControllerRef.current = null;
                      }
                      setUploading(false);
                      processingRef.current = false;
                    }}
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
          {groupInfo ? (
            // Group success view
            <>
              <h2>Files Uploaded as a Group!</h2>
              <p><strong>{groupInfo.fileCount} files</strong> have been uploaded as a group.</p>
              <p>Share this single code to let others download all files:</p>
              <div className="file-code">{groupInfo.groupCode}</div>
              <div className="success-actions">
                <button className="copy-button" onClick={() => {
                  navigator.clipboard.writeText(groupInfo.groupCode);
                  alert('Group code copied to clipboard!');
                }}>
                  Copy Group Code
                </button>
                <button className="new-upload-button" onClick={handleReset}>
                  Upload More Files
                </button>
              </div>

              <div className="group-files-info">
                <h3>Files in this group:</h3>
                <div className="files-list-compact">
                  {groupInfo.files.map((file, index) => (
                    <div key={index} className="group-file-item">
                      <span className="group-file-name">
                        {file.displayFilename || file.filename}
                      </span>
                      <span className="group-file-size">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : uploadResults.length === 1 ? (
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
            // Multiple files success view (individual codes)
            <>
              <h2>Files Uploaded Successfully!</h2>
              <p><strong>{uploadResults.length} files</strong> have been uploaded.</p>

              <div className="files-codes-list">
                {uploadResults.map((result, index) => {
                  // Use the original filename if available, otherwise fall back to result.filename
                  const displayName = result.originalFilename || result.filename;
                  
                  return (
                    <div key={`${result.code}-${index}`} className="file-code-item">
                      <div className="file-code-name">{displayName}</div>
                      <div className="file-code-value">{result.code}</div>
                      <button className="copy-code-button" onClick={() => {
                        navigator.clipboard.writeText(result.code);
                        alert(`Code for ${displayName} copied to clipboard!`);
                      }}>
                        Copy
                      </button>
                    </div>
                  );
                })}
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
