import FileDownload from '../components/FileDownload';

const DownloadPage = () => {
  return (
    <div className="container">
      <div className="page-header">
        <h1>Download Files</h1>
        <p className="page-description">
          Enter the unique code you received to download the shared file.
        </p>
      </div>
      <FileDownload />
    </div>
  );
};

export default DownloadPage;
