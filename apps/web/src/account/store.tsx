/**
 * Личный кабинет — React-контекст сессии.
 *
 * Один источник правды о текущем пользователе для всего фронта. На монтировании
 * тянет GET /api/auth/me (cookie-сессия), и при любом изменении статуса зовёт
 * setAuthed(...) из ./track, чтобы трекеры (плеер/ридер) знали, писать ли в БД.
 *
 * Провайдер живёт НАД плеером, но плеер от него не зависит (он общается с
 * телеметрией через модульный pub/sub в ./track) — поэтому циклов импорта нет.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { accountClient, type AccountUser } from "./api";
import { setAuthed } from "./track";

export type AuthStatus = "loading" | "authed" | "guest";

interface AuthApi {
  user: AccountUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AccountUser>;
  register: (email: string, password: string, name?: string) => Promise<AccountUser>;
  logout: () => Promise<void>;
  updateProfile: (patch: { name?: string; spiritualName?: string }) => Promise<AccountUser>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Любое изменение пользователя зеркалим в модульный флаг телеметрии.
  const apply = useCallback((u: AccountUser | null) => {
    setUser(u);
    setStatus(u ? "authed" : "guest");
    setAuthed(!!u);
  }, []);

  const refresh = useCallback(async () => {
    const u = await accountClient.me();
    apply(u);
  }, [apply]);

  useEffect(() => {
    let alive = true;
    accountClient
      .me()
      .then((u) => {
        if (alive) apply(u);
      })
      .catch(() => {
        if (alive) apply(null);
      });
    return () => {
      alive = false;
    };
  }, [apply]);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await accountClient.login(email, password);
      apply(u);
      return u;
    },
    [apply],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const u = await accountClient.register(email, password, name);
      apply(u);
      return u;
    },
    [apply],
  );

  const logout = useCallback(async () => {
    await accountClient.logout();
    apply(null);
  }, [apply]);

  const updateProfile = useCallback(
    async (patch: { name?: string; spiritualName?: string }) => {
      const u = await accountClient.updateProfile(patch);
      apply(u);
      return u;
    },
    [apply],
  );

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout, updateProfile, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен вызываться внутри <AuthProvider>");
  return ctx;
}
