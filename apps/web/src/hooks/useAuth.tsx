import { createContext, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, postJson } from "../api/client";
import type { User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: User | null }>("/api/auth/me"),
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      postJson<{ user: User }>("/api/auth/login", { email, password }),
    onSuccess: (payload) => {
      queryClient.setQueryData(["me"], { user: payload.user });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => postJson<{ ok: boolean }>("/api/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["me"], { user: null });
    }
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data?.user ?? null,
      loading: meQuery.isLoading,
      login: async (email, password) => {
        await loginMutation.mutateAsync({ email, password });
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
      }
    }),
    [loginMutation, logoutMutation, meQuery.data?.user, meQuery.isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
