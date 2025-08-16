type Props = { onGranted: (stream: MediaStream) => void };

const CameraPermission = ({ onGranted }: Props) => {
  const ask = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      onGranted(stream);
    } catch (e) {
      console.warn("Camera permission denied", e);
      alert("Camera permission is required to start the contest.");
    }
  };
  return (
    <button className="px-4 py-2 rounded border bg-white hover:bg-gray-50" onClick={ask}>
      Allow Camera
    </button>
  );
};
export default CameraPermission;