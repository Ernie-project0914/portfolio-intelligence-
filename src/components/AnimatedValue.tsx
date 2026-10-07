import { useEffect, useRef, useState } from "react";
export default function AnimatedValue({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(0);
  useEffect(() => {
    if (!/[0-9]/.test(value)) {
      previous.current = 0;
      setDisplay(value);
      return;
    }
    const number = Number(value.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(number)) {
      setDisplay(value);
      return;
    }
    const from = previous.current;
    previous.current = number;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const monetary = value.includes("$");
    const plus = value.startsWith("+");
    const suffix = value.endsWith("%") ? "%" : "";
    const decimals = value.includes(".") ? 2 : 0;
    let frame = 0;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / 850, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (number - from) * eased;
      const formatter = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      setDisplay(
        monetary
          ? `${current < 0 ? "-" : plus ? "+" : ""}$${formatter.format(Math.abs(current))}`
          : `${current >= 0 && plus ? "+" : ""}${formatter.format(current)}${suffix}`,
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(value);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span aria-label={value}>{display}</span>;
}
