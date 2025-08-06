const CameraPermission = ({ onGranted }) => {
    const handleRequest = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        onGranted();
      } catch {
        alert("Camera permission is required.");
      }
    };
    return <button onClick={handleRequest}>Allow Camera</button>;
  };
  export default CameraPermission;