"use client";

import { useState, useEffect, useRef } from "react";

function TypewriterText({ text, delay = 900, speed = 40 }: { text: string; delay?: number; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setShowCursor(true);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [text, delay, speed]);

  return (
    <span>
      {displayed}
      {showCursor && <span className="typewriter-cursor">|</span>}
    </span>
  );
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
function ScrambleText({ text, delay = 400 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState(text);
  const resolvedRef = useRef(0);

  useEffect(() => {
    setDisplayed(text.replace(/[^ ]/g, () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]));
    resolvedRef.current = 0;
    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        resolvedRef.current++;
        if (resolvedRef.current > text.length) { clearInterval(interval); return; }
        setDisplayed(
          text.slice(0, resolvedRef.current) +
          text.slice(resolvedRef.current).replace(/[^ ]/g, () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
        );
      }, 30);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [text, delay]);

  return <span>{displayed}</span>;
}

export function HeroAnimations() {
  return (
    <>
      <span>Re&#123;<ScrambleText text="defining" delay={300} />&#125; Privacy</span>
      <br />
      <span className="text-gradient-animated">
        <TypewriterText text="on Starknet" delay={900} speed={45} />
      </span>
    </>
  );
}
