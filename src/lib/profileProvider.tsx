// Profile system — fetches and caches user profiles from MongoDB API
// Provides: profile lookup by address, batch resolve, update profile

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { syncProfileName } from "@/lib/mockData";

export interface UserProfile {
  address: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface ProfileContextValue {
  /** Get cached profile (may be undefined if not fetched yet) */
  getProfile: (address: string) => UserProfile | undefined;
  /** Fetch profile from API (and cache) */
  fetchProfile: (address: string) => Promise<UserProfile | null>;
  /** Fetch profile by username */
  fetchProfileByUsername: (username: string) => Promise<UserProfile | null>;
  /** Batch resolve addresses → profiles (caches all) */
  batchResolve: (addresses: string[]) => Promise<Record<string, UserProfile>>;
  /** Update the connected user's profile */
  updateProfile: (data: { address: string; username?: string; displayName?: string; avatarUrl?: string }) => Promise<UserProfile>;
  /** Get display name: username > displayName > shortAddress */
  getDisplayName: (address: string) => string;
  /** Profile cache (for reactive reads) */
  profileCache: Record<string, UserProfile>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const API_BASE = "/api";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profileCache, setProfileCache] = useState<Record<string, UserProfile>>({});
  const inflightRef = useRef<Record<string, Promise<UserProfile | null>>>({});

  const cacheProfile = useCallback((p: UserProfile) => {
    setProfileCache((prev) => ({ ...prev, [p.address.toLowerCase()]: p }));
    // Sync to global cache so non-React code (enrichedToToken) can resolve display names
    const displayName = p.displayName || p.username;
    if (displayName) syncProfileName(p.address, displayName);
  }, []);

  const getProfile = useCallback(
    (address: string): UserProfile | undefined => {
      return profileCache[address.toLowerCase()];
    },
    [profileCache]
  );

  const fetchProfile = useCallback(
    async (address: string): Promise<UserProfile | null> => {
      const key = address.toLowerCase();

      // Dedup in-flight requests
      if (inflightRef.current[key]) return inflightRef.current[key];

      const promise = (async () => {
        try {
          const res = await fetch(`${API_BASE}/profile?address=${encodeURIComponent(address)}`);
          if (res.status === 404) return null;
          if (!res.ok) return null;
          const data = await res.json();
          const profile: UserProfile = {
            address: data.address,
            username: data.username,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
          };
          cacheProfile(profile);
          return profile;
        } catch {
          return null;
        } finally {
          delete inflightRef.current[key];
        }
      })();

      inflightRef.current[key] = promise;
      return promise;
    },
    [cacheProfile]
  );

  const fetchProfileByUsername = useCallback(
    async (username: string): Promise<UserProfile | null> => {
      try {
        const res = await fetch(`${API_BASE}/profile?username=${encodeURIComponent(username)}`);
        if (res.status === 404) return null;
        if (!res.ok) return null;
        const data = await res.json();
        const profile: UserProfile = {
          address: data.address,
          username: data.username,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
        };
        cacheProfile(profile);
        return profile;
      } catch {
        return null;
      }
    },
    [cacheProfile]
  );

  const batchResolve = useCallback(
    async (addresses: string[]): Promise<Record<string, UserProfile>> => {
      if (addresses.length === 0) return {};

      // Filter out already cached
      const uncached = addresses.filter((a) => !profileCache[a.toLowerCase()]);
      if (uncached.length === 0) {
        const result: Record<string, UserProfile> = {};
        for (const a of addresses) {
          const cached = profileCache[a.toLowerCase()];
          if (cached) result[a.toLowerCase()] = cached;
        }
        return result;
      }

      try {
        const res = await fetch(`${API_BASE}/profiles-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses: uncached }),
        });

        if (!res.ok) return {};
        const map = await res.json();

        // Cache all resolved profiles
        const newCache: Record<string, UserProfile> = {};
        for (const [addr, data] of Object.entries(map) as [string, any][]) {
          const profile: UserProfile = {
            address: data.address,
            username: data.username,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
          };
          newCache[addr] = profile;
        }

        setProfileCache((prev) => ({ ...prev, ...newCache }));

        // Return combined result
        const result: Record<string, UserProfile> = { ...newCache };
        for (const a of addresses) {
          const key = a.toLowerCase();
          if (!result[key] && profileCache[key]) {
            result[key] = profileCache[key];
          }
        }
        return result;
      } catch {
        return {};
      }
    },
    [profileCache]
  );

  const updateProfile = useCallback(
    async (data: { address: string; username?: string; displayName?: string; avatarUrl?: string }): Promise<UserProfile> => {
      const res = await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(err.error || "Update failed");
      }

      const result = await res.json();
      const profile: UserProfile = {
        address: result.address,
        username: result.username,
        displayName: result.displayName,
        avatarUrl: result.avatarUrl,
      };
      cacheProfile(profile);
      return profile;
    },
    [cacheProfile]
  );

  const getDisplayName = useCallback(
    (address: string): string => {
      const profile = profileCache[address.toLowerCase()];
      if (profile?.displayName) return profile.displayName;
      if (profile?.username) return profile.username;
      return address.slice(0, 6) + "..." + address.slice(-4);
    },
    [profileCache]
  );

  return (
    <ProfileContext.Provider
      value={{
        getProfile,
        fetchProfile,
        fetchProfileByUsername,
        batchResolve,
        updateProfile,
        getDisplayName,
        profileCache,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfiles must be inside ProfileProvider");
  return ctx;
}
