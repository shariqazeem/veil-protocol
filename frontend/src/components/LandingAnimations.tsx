"use client";

import { useState, useEffect, useRef, ReactNode } from "react";

// ── Typewriter ──
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

// ── ScrambleText ──
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
        if (resolvedRef.current > text.length) {
          clearInterval(interval);
          return;
        }
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

// ── Hero text animations (only client component needed for the hero) ──
export function HeroAnimations() {
  return (
    <>
      <span><ScrambleText text="AI-Powered Privacy" delay={300} /></span>
      <br />
      <span className="text-gradient-animated">
        <TypewriterText text="for Bitcoin on Starknet" delay={900} speed={45} />
      </span>
    </>
  );
}

// ── IntersectionObserver-based scroll animation (no framer-motion) ──
export function AnimatedSection({ children, direction }: { children: ReactNode; direction?: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const translateClass = direction === "left" ? "-translate-x-8" : direction === "right" ? "translate-x-8" : "translate-y-6";

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${translateClass}`}`}
    >
      {children}
    </div>
  );
}

// ── Scroll-triggered card animation ──
export function AnimatedCard({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      style={{ transitionDelay: visible ? `${delay}s` : "0s" }}
    >
      {children}
    </div>
  );
}

// ── Tech tag pop-in ──
export function AnimatedTechTag({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={`inline-block transition-all duration-300 ease-out ${visible ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}
      style={{ transitionDelay: visible ? `${delay}s` : "0s" }}
    >
      {children}
    </span>
  );
}
