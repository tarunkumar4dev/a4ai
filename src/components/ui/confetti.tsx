// components/ui/confetti.tsx
export const Confetti = () => {
    return (
      <div className="fixed inset-0 pointer-events-none z-40">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
    );
  };