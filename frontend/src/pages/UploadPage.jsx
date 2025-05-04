import FileUpload from '../components/FileUpload';

const UploadPage = () => {
  return (
    <div className="container">
      <div className="page-header">
        <h1>Share Your Files</h1>
        <p className="page-description">
          Upload your files securely and share them with others using a unique code.
        </p>
      </div>
      <FileUpload />
    </div>
  );
};

export default UploadPage;
