import { useEffect, useState } from "react";

export default function Timer({
  initialMinutes = 30,
  onTimeUp,
}: {
  initialMinutes?: number;
  onTimeUp: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="text-center space-y-2">
      <h3 className="text-xl font-semibold">Time Remaining</h3>
      <div className="text-4xl font-bold text-gray-800 tracking-wider">
        {formatTime(secondsLeft)}
      </div>
    </div>
  );
}
