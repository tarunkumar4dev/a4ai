import { useState, useEffect } from 'react';

type Props = { 
  onGranted: (stream: MediaStream | null) => void;
  className?: string;
};

const ScreenSharePermission = ({ onGranted, className = '' }: Props) => {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSupport = () => {
      try {
        // Check for mobile devices
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
        
        // Proper feature detection for screen sharing
        const isScreenShareSupported = 
          !!navigator.mediaDevices && 
          typeof navigator.mediaDevices.getDisplayMedia === 'function';
        
        setIsSupported(!isMobileDevice && isScreenShareSupported);
      } catch (error) {
        console.error('Error checking screen share support:', error);
        setIsSupported(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkSupport();
  }, []);

  const requestScreenShare = async () => {
    try {
      if (!isSupported) {
        throw new Error('Screen sharing not supported');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Typically screen sharing doesn't include audio by default
      });

      // Handle when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        onGranted(null);
      };

      onGranted(stream);
    } catch (error) {
      console.warn('Screen share permission denied:', error);
      onGranted(null);
    }
  };

  // Show nothing while checking or if not supported
  if (isChecking || !isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={requestScreenShare}
      className={`px-4 py-2 rounded border bg-white hover:bg-gray-50 transition-colors ${className}`}
      aria-label="Allow screen sharing (optional)"
    >
      Allow Screen Share (Optional)
    </button>
  );
};

export default ScreenSharePermission;