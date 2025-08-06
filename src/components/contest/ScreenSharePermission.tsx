const ScreenSharePermission = ({ onGranted }) => {
    const handleRequest = async () => {
      try {
        // This will prompt the user to share their screen
        await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        onGranted();
      } catch {
        alert("Screen sharing permission is required.");
      }
    };
    return <button onClick={handleRequest}>Allow Screen Share</button>;
  };
  export default ScreenSharePermission;