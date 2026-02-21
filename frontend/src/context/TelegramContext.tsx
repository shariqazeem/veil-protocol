"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Telegram WebApp type stubs (subset of the full API)
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramMainButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setText(text: string): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  MainButton: TelegramMainButton;
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TelegramContextState {
  isTelegram: boolean;
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  startParam: string | null;
}

const TelegramContext = createContext<TelegramContextState>({
  isTelegram: false,
  webApp: null,
  user: null,
  startParam: null,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramContextState>({
    isTelegram: false,
    webApp: null,
    user: null,
    startParam: null,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    // Signal to Telegram that the Mini-App is ready
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user ?? null;
    const startParam = tg.initDataUnsafe?.start_param ?? null;

    setState({
      isTelegram: true,
      webApp: tg,
      user,
      startParam,
    });
  }, []);

  return (
    <TelegramContext.Provider value={state}>
      {children}
    </TelegramContext.Provider>
  );
}
