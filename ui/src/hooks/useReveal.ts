import { useEffect, useRef, useState, CSSProperties } from "react";

export function useReveal(delayMs = 0, threshold = 0.15) {
  const ref = useRef<HTMLDivElement | HTMLLIElement | HTMLAnchorElement | any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const style: CSSProperties = {
    transition: "all 700ms ease-out",
    transitionDelay: `${delayMs}ms`,
    willChange: "transform, opacity",
    transform: isVisible ? "translateY(0)" : "translateY(2rem)",
    opacity: isVisible ? 1 : 0,
  };

  return { ref, style };
}
