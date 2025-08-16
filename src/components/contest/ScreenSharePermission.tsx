type Props = { onGranted: (stream: MediaStream) => void };

const ScreenSharePermission = ({ onGranted }: Props) => {
  const ask = async () => {
    try {
      const anyMedia = navigator.mediaDevices as any;
      if (!anyMedia?.getDisplayMedia) throw new Error("Screen share not supported");
      const stream: MediaStream = await anyMedia.getDisplayMedia({ video: true });
      onGranted(stream);
    } catch (e) {
      console.warn("Screen share permission denied", e);
      alert("Screen sharing permission is required to start the contest.");
    }
  };
  return (
    <button className="px-4 py-2 rounded border bg-white hover:bg-gray-50" onClick={ask}>
      Allow Screen Share
    </button>
  );
};
export default ScreenSharePermission;