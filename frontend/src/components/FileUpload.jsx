import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import './FileUpload.css';

// Helper function to create a file group
const createFileGroup = async (fileIds, groupName) => {
  try {
    const response = await api.post('/api/group', {
      fileIds,
      groupName
    });
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
      // Use the provided file or fall back to the current file from state
      const currentFile = fileToUpload || files[currentFileIndex];
      const currentIndex = fileIndex !== undefined ? fileIndex : currentFileIndex;

      // Validate file before uploading
      if (!currentFile || currentFile.size === 0) {
        console.error(`Invalid file at index ${currentIndex}`);
        setError('Invalid file. Please select a valid file.');

        // Try to process next file if in multiple files mode
        if (multipleFilesMode) {
          return null; // Return null to indicate no successful upload
        } else {
          setUploading(false);
          return null;
        }
      }

      // Create a new FormData instance for this file
      const formData = new FormData();
      formData.append('file', currentFile);

      // Add optimization hints to the request
      formData.append('optimized', compressFiles ? 'true' : 'false');

      // Add file size info to help server optimize handling
      formData.append('fileSize', currentFile.size.toString());

      // Create abort controller for cancellation if not already created
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const signal = abortControllerRef.current.signal;

      console.log(`Starting regular upload for file: ${currentFile.name}, size: ${formatFileSize(currentFile.size)}, compression: ${compressFiles ? 'enabled' : 'disabled'}`);

      // Important: Do NOT set Content-Type header for multipart/form-data
      // Let the browser set it automatically with the correct boundary
      const response = await api.post('/api/upload', formData, {
        // No Content-Type header - handled by request interceptor
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
            // For browsers that don't provide progress.total
            setUploadProgress(50); // Show some progress
          }
        },
        // Add timeout to prevent hanging uploads
        timeout: 5 * 60 * 1000, // 5 minutes timeout
      });

      // Check if the response is valid
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      console.log(`Upload successful for ${currentFile.name}:`, response.data);

      // Add to results array - use a callback to ensure we're working with the latest state
      setUploadResults(prev => {
        const newResults = [...prev, response.data];
        console.log(`Updated upload results: ${newResults.length} files`);
        return newResults;
      });

      // Update progress to 100% for this file
      setUploadProgress(100);

      // Return the response data to indicate success
      return response.data;
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        setError('Upload was cancelled');
        return null;
      }

      // Get the current file for error reporting
      const currentFile = fileToUpload || files[currentFileIndex];
      const fileName = currentFile ? currentFile.name : `file at index ${fileIndex || currentFileIndex}`;
      const fileSize = currentFile ? formatFileSize(currentFile.size) : 'unknown size';

      console.error(`Upload error for ${fileName}:`, err);

      // More detailed error message
      let errorMessage = 'Failed to upload file. Please try again.';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      // Add file info to error for better debugging
      console.error(`Error uploading file: ${fileName}, size: ${fileSize}`);

      // Set the error message but don't clear it immediately
      setError(errorMessage);

      // Return null to indicate failure
      return null;
    }
  };

  // Chunked upload for larger files with parallel uploads
  const handleChunkedUpload = async (fileToUpload, fileIndex) => {
    try {
      // Use the provided file or fall back to the current file from state
      const currentFile = fileToUpload || files[currentFileIndex];
      const currentIndex = fileIndex !== undefined ? fileIndex : currentFileIndex;

      // Validate file before uploading
      if (!currentFile || currentFile.size === 0) {
        console.error(`Invalid file at index ${currentIndex}`);
        setError('Invalid file. Please select a valid file.');

        // Try to process next file if in multiple files mode
        if (multipleFilesMode) {
          return null; // Return null to indicate no successful upload
        } else {
          setUploading(false);
          return null;
        }
      }

      console.log(`Starting chunked upload with direct file reference: ${currentFile.name}`);

    // Dynamically determine chunk size based on file size
    // Smaller chunks for smaller files, larger chunks for larger files
    let chunkSize = 5 * 1024 * 1024; // Default 5MB chunks
    if (currentFile.size > 100 * 1024 * 1024) { // For files > 100MB
      chunkSize = 10 * 1024 * 1024; // Use 10MB chunks
    } else if (currentFile.size < 20 * 1024 * 1024) { // For files < 20MB
      // For small files, use smaller chunks but ensure they're not too small
      // Minimum chunk size of 1MB to prevent excessive requests
      chunkSize = Math.max(1 * 1024 * 1024, Math.ceil(currentFile.size / 4));
    }

    // Ensure chunk size is reasonable
    chunkSize = Math.min(chunkSize, currentFile.size); // Don't make chunks larger than the file

    const chunks = Math.ceil(currentFile.size / chunkSize);
    const uploadId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 10);

    // Determine optimal number of concurrent uploads based on file size and network conditions
    // More concurrent uploads for larger files, fewer for smaller files
    let concurrentUploads = 3; // Default
    if (currentFile.size > 100 * 1024 * 1024) {
      concurrentUploads = 4; // More concurrent uploads for very large files
    } else if (currentFile.size < 20 * 1024 * 1024) {
      concurrentUploads = 2; // Fewer concurrent uploads for smaller files
    }

    // Track uploaded chunks
    const uploadedChunks = new Set();
    const failedChunks = [];

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    console.log(`Starting chunked upload for file: ${currentFile.name}, size: ${formatFileSize(currentFile.size)}, chunks: ${chunks}, concurrent uploads: ${concurrentUploads}, compression: ${compressFiles ? 'enabled' : 'disabled'}`);

    try {
      // Step 1: Initialize the upload
      await api.post('/api/upload/init', {
        uploadId,
        filename: currentFile.name,
        totalChunks: chunks,
        fileSize: currentFile.size,
        mimeType: currentFile.type,
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
          const end = Math.min(currentFile.size, start + chunkSize);
          const chunk = currentFile.slice(start, end);

          // Validate chunk
          if (!chunk || chunk.size === 0) {
            console.error(`Invalid chunk at index ${chunkIndex}: empty or zero size`);
            failedChunks.push(chunkIndex);
            return false;
          }

          const formData = new FormData();
          formData.append('chunk', chunk, 'chunk'); // Add a filename to help some browsers
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', chunkIndex);

          // Add retry mechanism
          let retries = 0;
          const maxRetries = 2;

          while (retries <= maxRetries) {
            try {
              // Important: Do NOT set Content-Type header for multipart/form-data
              // Let the browser set it automatically with the correct boundary
              await api.post('/api/upload/chunk', formData, {
                signal,
                // We'll handle progress separately for parallel uploads
                onUploadProgress: (progressEvent) => {
                  // This progress is just for this chunk
                  if (progressEvent.total) {
                    const chunkProgress = progressEvent.loaded / progressEvent.total;
                    // We don't update the overall progress here to avoid UI jitter
                  }
                },
                // Shorter timeout for chunks
                timeout: 60000 // 1 minute timeout per chunk
              });

              // Success - break out of retry loop
              break;
            } catch (err) {
              retries++;

              // If this is the last retry, throw the error
              if (retries > maxRetries || signal.aborted) {
                throw err;
              }

              // Otherwise wait and retry
              console.warn(`Retrying chunk ${chunkIndex} (attempt ${retries}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            }
          }

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

      // Check if the response is valid
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      console.log(`Chunked upload successful for ${currentFile.name}:`, response.data);

      // Add to results array - use a callback to ensure we're working with the latest state
      setUploadResults(prev => {
        const newResults = [...prev, response.data];
        console.log(`Updated upload results: ${newResults.length} files`);
        return newResults;
      });

      // Update progress to 100% for this file
      setUploadProgress(100);

      // Return the response data to indicate success
      return response.data;
    } catch (err) {
      if (signal.aborted || err.message === 'Upload cancelled') {
        setError('Upload was cancelled');
        return null;
      }

      // Get the current file for error reporting
      const currentFile = files[currentFileIndex];
      const fileName = currentFile ? currentFile.name : `file at index ${currentFileIndex}`;
      const fileSize = currentFile ? formatFileSize(currentFile.size) : 'unknown size';

      console.error(`Chunked upload error for ${fileName}:`, err);

      // More detailed error message
      let errorMessage = 'Failed to upload file. Please try again.';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      // Add file info to error for better debugging
      console.error(`Error uploading file: ${fileName}, size: ${fileSize}`);

      // If we have failed chunks, add that info
      if (failedChunks && failedChunks.length > 0) {
        console.error(`Failed chunks: ${failedChunks.length} out of ${chunks}`);
        if (failedChunks.length < chunks / 2) {
          errorMessage += ' Some chunks failed to upload. Try again or use a smaller file.';
        } else {
          errorMessage += ' Most chunks failed to upload. Check your connection and try again.';
        }
      }

      // Set the error message but don't clear it immediately
      setError(errorMessage);

      // Return null to indicate failure
      return null;
    }
  }

  // Cancel the ongoing upload
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Process the next file in the queue
  const processNextFile = () => {
    // Prevent multiple simultaneous calls to processNextFile
    if (processingRef.current) {
      console.log('Already processing a file, ignoring duplicate call');
      return;
    }

    processingRef.current = true;

    // Use setTimeout to prevent stack overflow with recursive calls
    // This also gives the UI a chance to update between files
    setTimeout(() => {
      try {
        // Move to the next file
        const nextIndex = currentFileIndex + 1;

        // Debug log to track file processing
        console.log(`Checking for next file. Current index: ${currentFileIndex}, Next index: ${nextIndex}, Total files: ${files.length}`);

        if (nextIndex < files.length) {
          // More files to process - IMPORTANT: We need to update the state and wait for it to be applied
          setCurrentFileIndex(nextIndex);

          // Reset progress for the new file
          setUploadProgress(0);

          // Get a direct reference to the next file to avoid state closure issues
          const nextFile = files[nextIndex];

          if (!nextFile) {
            console.error(`No file found at index ${nextIndex}`);
            processingRef.current = false;
            processNextFile();
            return;
          }

          // Log which file we're processing now
          console.log(`Processing next file (${nextIndex + 1}/${files.length}): ${nextFile.name}, size: ${formatFileSize(nextFile.size)}, type: ${nextFile.type}`);

          // Validate the file
          if (nextFile.size === 0) {
            console.error(`Invalid file at index ${nextIndex}: zero size`);
            // Skip this file and move to the next one
            processingRef.current = false;
            processNextFile();
            return;
          }

          // Reset any previous errors
          setError(null);

          // Determine upload method based on file size
          const useChunks = nextFile.size > 2 * 1024 * 1024;

          // Create a new abort controller for this file
          abortControllerRef.current = new AbortController();

          // We need to wait for state updates to complete before starting the upload
          // This ensures that the UI is updated correctly and the correct file is used
          setTimeout(() => {
            // Update the chunked upload state
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

            // Start uploading the next file after a longer delay to ensure state updates are fully applied
            setTimeout(() => {
              // Double-check that we're still on the correct file index
              if (currentFileIndex !== nextIndex) {
                console.error(`File index mismatch: expected ${nextIndex}, got ${currentFileIndex}`);
                // Force the correct index
                setCurrentFileIndex(nextIndex);

                // Wait a bit more before proceeding
                setTimeout(() => {
                  console.log(`Starting upload for file: ${nextFile.name} (${useChunks ? 'chunked' : 'regular'} upload)`);

                  // Create a new FormData for this specific file to avoid any state issues
                  const formData = new FormData();
                  formData.append('file', nextFile);
                  formData.append('optimized', compressFiles ? 'true' : 'false');
                  formData.append('fileSize', nextFile.size.toString());

                  // We're using a direct upload approach to avoid state closure issues
                  const uploadPromise = useChunks
                    ? handleChunkedUpload(nextFile, nextIndex)
                    : handleDirectUpload(formData, nextFile, nextIndex);

                  uploadPromise
                    .then(async (result) => {
                      console.log(`Successfully uploaded file: ${nextFile.name}`);
                      processingRef.current = false;

                      // If we have more files to process, continue
                      if (nextIndex + 1 < files.length) {
                        processNextFile();
                      } else {
                        // All files processed
                        console.log(`All ${files.length} files processed successfully`);

                        // If we want to create a group
                        if (createGroup && files.length > 1) {
                          console.log('Creating file group...');

                          try {
                            // Get all file IDs from the upload results
                            const fileIds = uploadResults.map(result => result.code);

                            // Create the group
                            const groupResult = await createFileGroup(fileIds, groupName || undefined);
                            console.log('Group created:', groupResult);

                            // Store the group info
                            setGroupInfo(groupResult);
                          } catch (error) {
                            console.error('Failed to create group:', error);
                            setError('Files were uploaded but failed to create group. You can still use individual file codes.');
                          }
                        }

                        setUploading(false);
                        setOverallProgress(100);
                      }
                    })
                    .catch(err => {
                      console.error(`Error uploading file ${nextIndex} (${nextFile.name}):`, err);
                      processingRef.current = false;
                      // Continue with next file despite error
                      if (nextIndex + 1 < files.length) {
                        processNextFile();
                      } else {
                        setUploading(false);
                      }
                    });
                }, 500);
              } else {
                console.log(`Starting upload for file: ${nextFile.name} (${useChunks ? 'chunked' : 'regular'} upload)`);

                // Create a new FormData for this specific file to avoid any state issues
                const formData = new FormData();
                formData.append('file', nextFile);
                formData.append('optimized', compressFiles ? 'true' : 'false');
                formData.append('fileSize', nextFile.size.toString());

                // We're using a direct upload approach to avoid state closure issues
                const uploadPromise = useChunks
                  ? handleChunkedUpload(nextFile, nextIndex)
                  : handleDirectUpload(formData, nextFile, nextIndex);

                uploadPromise
                  .then(async (result) => {
                    console.log(`Successfully uploaded file: ${nextFile.name}`);
                    processingRef.current = false;

                    // If we have more files to process, continue
                    if (nextIndex + 1 < files.length) {
                      processNextFile();
                    } else {
                      // All files processed
                      console.log(`All ${files.length} files processed successfully`);

                      // If we want to create a group
                      if (createGroup && files.length > 1) {
                        console.log('Creating file group...');

                        try {
                          // Get all file IDs from the upload results
                          const fileIds = uploadResults.map(result => result.code);

                          // Create the group
                          const groupResult = await createFileGroup(fileIds, groupName || undefined);
                          console.log('Group created:', groupResult);

                          // Store the group info
                          setGroupInfo(groupResult);
                        } catch (error) {
                          console.error('Failed to create group:', error);
                          setError('Files were uploaded but failed to create group. You can still use individual file codes.');
                        }
                      }

                      setUploading(false);
                      setOverallProgress(100);
                    }
                  })
                  .catch(err => {
                    console.error(`Error uploading file ${nextIndex} (${nextFile.name}):`, err);
                    processingRef.current = false;
                    // Continue with next file despite error
                    if (nextIndex + 1 < files.length) {
                      processNextFile();
                    } else {
                      setUploading(false);
                    }
                  });
              }
            }, 500);
          }, 500);
        } else {
          // All files processed
          console.log(`All ${files.length} files processed successfully`);
          setUploading(false);
          setOverallProgress(100);
          processingRef.current = false;
        }
      } catch (error) {
        console.error('Error in processNextFile:', error);
        processingRef.current = false;
      }
    }, 1000); // Increased delay to ensure proper state updates between files
  };

  // Direct upload function that doesn't rely on component state
  const handleDirectUpload = async (formData, file, fileIndex) => {
    try {
      // Create abort controller for cancellation if not already created
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const signal = abortControllerRef.current.signal;

      console.log(`Starting direct upload for file: ${file.name}, size: ${formatFileSize(file.size)}, compression: ${compressFiles ? 'enabled' : 'disabled'}`);

      // Important: Do NOT set Content-Type header for multipart/form-data
      const response = await api.post('/api/upload', formData, {
        signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);

            // Update overall progress
            const overallPercent = calculateOverallProgress(
              fileIndex,
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

      console.log(`Upload successful for ${file.name}:`, response.data);

      // Add to results array - use a callback to ensure we're working with the latest state
      setUploadResults(prev => {
        const newResults = [...prev, response.data];
        console.log(`Updated upload results: ${newResults.length} files`);
        return newResults;
      });

      // Update progress to 100% for this file
      setUploadProgress(100);

      // Return the response data to indicate success
      return response.data;
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        setError('Upload was cancelled');
        return null;
      }

      console.error(`Upload error for ${file.name}:`, err);

      // More detailed error message
      let errorMessage = 'Failed to upload file. Please try again.';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      // Add file info to error for better debugging
      console.error(`Error uploading file: ${file.name}, size: ${formatFileSize(file.size)}`);

      // Set the error message but don't clear it immediately
      setError(errorMessage);

      // Return null to indicate failure
      return null;
    }
  }

  // Main upload handler
  const handleUpload = async () => {
    // If already processing, don't start a new upload
    if (processingRef.current) {
      console.log('Already processing files, ignoring duplicate upload request');
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
    processingRef.current = true;

    // Log the upload process
    console.log(`Starting upload of ${files.length} files:`);
    files.forEach((file, index) => {
      console.log(`File ${index + 1}: ${file.name}, size: ${formatFileSize(file.size)}, type: ${file.type}`);
    });

    // Filter out any invalid files
    const validFiles = files.filter(file => file && file.size > 0);

    if (validFiles.length === 0) {
      setError('No valid files to upload. Files may be empty or corrupted.');
      setUploading(false);
      processingRef.current = false;
      return;
    }

    if (validFiles.length !== files.length) {
      console.warn(`Filtered out ${files.length - validFiles.length} invalid files`);
      // Update the files state with only valid files
      setFiles(validFiles);
    }

    // Validate the first file
    const firstFile = validFiles[0];
    if (!firstFile) {
      setError('Invalid file. Please select valid files.');
      setUploading(false);
      processingRef.current = false;
      return;
    }

    // Create a new abort controller for this upload session
    abortControllerRef.current = new AbortController();

    try {
      // Start with the first file
      const useChunksForFirstFile = firstFile.size > 2 * 1024 * 1024;
      setUseChunkedUpload(useChunksForFirstFile);

      console.log(`Starting upload for first file: ${firstFile.name} (${useChunksForFirstFile ? 'chunked' : 'regular'} upload)`);

      // We need to wait for state updates to complete before starting the upload
      setTimeout(async () => {
        try {
          let result;
          if (useChunksForFirstFile) {
            result = await handleChunkedUpload();
          } else {
            result = await handleRegularUpload();
          }

          // If the upload was successful and we're in multiple files mode
          if (result && multipleFilesMode && validFiles.length > 1) {
            processingRef.current = false;

            // If this is the last file and we want to create a group
            if (currentFileIndex + 1 >= validFiles.length && createGroup) {
              // We've processed all files, now create a group
              console.log('All files uploaded, creating group...');

              // Get all file IDs from the upload results
              const fileIds = uploadResults.map(result => result.code);

              try {
                // Create the group
                const groupResult = await createFileGroup(fileIds, groupName || undefined);
                console.log('Group created:', groupResult);

                // Store the group info
                setGroupInfo(groupResult);

                // Set overall progress to 100%
                setOverallProgress(100);
                setUploading(false);
              } catch (error) {
                console.error('Failed to create group:', error);
                setError('Files were uploaded but failed to create group. You can still use individual file codes.');
                setOverallProgress(100);
                setUploading(false);
              }
            } else {
              // Process the next file
              processNextFile();
            }
          } else {
            // If we only had one file or the upload failed
            processingRef.current = false;
            if (!result) {
              // If the upload failed, make sure we set uploading to false
              setUploading(false);
            } else if (validFiles.length === 1) {
              // If we only had one file and it succeeded, set overall progress to 100%
              setOverallProgress(100);
              setUploading(false);
            }
          }
        } catch (err) {
          console.error('Upload error in first file:', err);

          // More detailed error message
          let errorMessage = 'An unexpected error occurred. Please try again.';

          if (err.message) {
            errorMessage = err.message;
          } else if (err.response?.data?.error) {
            errorMessage = err.response.data.error;
          }

          setError(errorMessage);

          // If we're in multiple files mode, try to continue with the next file
          if (multipleFilesMode && validFiles.length > 1) {
            processingRef.current = false;
            processNextFile();
          } else {
            processingRef.current = false;
            setUploading(false);
          }
        }
      }, 300);
    } catch (err) {
      console.error('Upload initialization error:', err);

      // More detailed error message
      let errorMessage = 'Failed to start upload. Please try again.';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      setError(errorMessage);
      processingRef.current = false;
      setUploading(false);
    }
  };

  const handleReset = () => {
    // Cancel any ongoing upload
    if (uploading && abortControllerRef.current) {
      handleCancelUpload();
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
                      <span className="group-file-name">{file.filename}</span>
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

              {/* Check for duplicate filenames and add index if needed */}
              <div className="files-codes-list">
                {uploadResults.map((result, index) => {
                  // Check if this filename appears multiple times
                  const isDuplicate = uploadResults.filter(r => r.filename === result.filename).length > 1;

                  // If duplicate, add the index to make it clear which is which
                  const displayName = isDuplicate
                    ? `${result.filename} (${index + 1})`
                    : result.filename;

                  return (
                    <div key={index} className="file-code-item">
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
