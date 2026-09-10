const LEAF_PATH = "M12 2C7 4 3 9 3 15c3 1 7 0 10-3s5-7 3-10c-1.5 1-3 1.5-4 0z";

const LEAVES = [
  { left: "6%", size: 18, duration: 32, delay: 0, drift: 40 },
  { left: "18%", size: 13, duration: 27, delay: 4, drift: -30 },
  { left: "34%", size: 20, duration: 38, delay: 9, drift: 25 },
  { left: "52%", size: 15, duration: 30, delay: 2, drift: -45 },
  { left: "68%", size: 22, duration: 42, delay: 12, drift: 35 },
  { left: "82%", size: 14, duration: 26, delay: 6, drift: -20 },
  { left: "92%", size: 17, duration: 35, delay: 15, drift: 30 },
];

export default function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="bg-blob blob-a" />
      <div className="bg-blob blob-b" />
      <div className="bg-blob blob-c" />
      {LEAVES.map((leaf, i) => (
        <svg
          key={i}
          className="bg-leaf"
          style={{
            left: leaf.left,
            width: leaf.size,
            height: leaf.size,
            animationDuration: `${leaf.duration}s`,
            animationDelay: `${leaf.delay}s`,
            "--drift": `${leaf.drift}px`,
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={LEAF_PATH} />
        </svg>
      ))}
    </div>
  );
}
