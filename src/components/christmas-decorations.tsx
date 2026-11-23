import { useEffect, useState, type CSSProperties } from "react";
import { Snowflake, Sparkles } from "lucide-react";
import { isChristmasDecorationsActive } from "@/lib/christmas";

const flakes = [
  { left: "4%", size: 12, duration: "15s", delay: "-7s" },
  { left: "11%", size: 18, duration: "19s", delay: "-14s" },
  { left: "19%", size: 10, duration: "13s", delay: "-3s" },
  { left: "28%", size: 15, duration: "18s", delay: "-11s" },
  { left: "37%", size: 11, duration: "16s", delay: "-5s" },
  { left: "46%", size: 17, duration: "21s", delay: "-17s" },
  { left: "56%", size: 12, duration: "14s", delay: "-8s" },
  { left: "64%", size: 16, duration: "20s", delay: "-2s" },
  { left: "73%", size: 10, duration: "15s", delay: "-12s" },
  { left: "82%", size: 18, duration: "22s", delay: "-6s" },
  { left: "90%", size: 13, duration: "17s", delay: "-15s" },
  { left: "97%", size: 11, duration: "14s", delay: "-4s" },
];

const bulbs = [
  { left: "2%", top: "9px" }, { left: "10%", top: "28px" },
  { left: "18%", top: "44px" }, { left: "26%", top: "49px" },
  { left: "34%", top: "42px" }, { left: "42%", top: "28px" },
  { left: "50%", top: "15px" }, { left: "58%", top: "12px" },
  { left: "66%", top: "19px" }, { left: "74%", top: "30px" },
  { left: "82%", top: "39px" }, { left: "90%", top: "43px" },
  { left: "98%", top: "38px" },
];

type FlakeStyle = CSSProperties & {
  "--flake-left": string;
  "--flake-size": string;
  "--flake-duration": string;
  "--flake-delay": string;
};

function useChristmasDecorations() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timeout: number;
    const update = () => {
      const now = new Date();
      setActive(isChristmasDecorationsActive(now));
      // Reavalia na virada de cada minuto, inclusive ao chegar o limite final.
      const elapsedInMinute = now.getSeconds() * 1000 + now.getMilliseconds();
      timeout = window.setTimeout(update, 60_000 - elapsedInMinute + 20);
    };
    update();
    return () => window.clearTimeout(timeout);
  }, []);

  return active;
}

export function ChristmasDecorations({ variant }: { variant: "cover" | "auth" }) {
  const active = useChristmasDecorations();
  if (!active) return null;

  return (
    <div className={`christmas-decorations christmas-${variant}`} aria-hidden="true">
      <svg className="christmas-cord" viewBox="0 0 1000 70" preserveAspectRatio="none">
        <path d="M-20 4 C170 78 330 78 490 18 S820 -5 1020 45" />
      </svg>
      <div className="christmas-lights">
        {bulbs.map((bulb, index) => (
          <span key={`${bulb.left}-${bulb.top}`} className={`christmas-bulb christmas-bulb-${index % 3}`} style={{ left: bulb.left, top: bulb.top }} />
        ))}
      </div>
      <div className="christmas-ornaments">
        <span className="christmas-ornament christmas-ornament-one"><i /></span>
        <span className="christmas-ornament christmas-ornament-two"><i /></span>
        <span className="christmas-ornament christmas-ornament-three"><i /></span>
      </div>
      <div className="christmas-snow">
        {flakes.map((flake) => (
          <Snowflake
            key={flake.left}
            className="christmas-snowflake"
            style={{
              "--flake-left": flake.left,
              "--flake-size": `${flake.size}px`,
              "--flake-duration": flake.duration,
              "--flake-delay": flake.delay,
            } as FlakeStyle}
          />
        ))}
      </div>
    </div>
  );
}

export function ChristmasBadge() {
  const active = useChristmasDecorations();
  if (!active) return null;

  return (
    <span className="christmas-badge">
      <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
      Boas festas
      <Sparkles className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}
