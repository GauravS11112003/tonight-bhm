"use client";

import { useCallback, useEffect, useState } from "react";
import type { Action, Store } from "@/lib/volunteers/store";

/** Shared by the volunteer app and the staff board: load the store, poll it, send actions. */
export function useVolunteerStore(pollMs = 4000) {
  const [store, setStore] = useState<Store>({ signups: [], requests: [] });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteers", { cache: "no-store" });
      if (res.ok) { setStore(await res.json()); setLoaded(true); }
    } catch { /* offline: keep showing the last state */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const send = useCallback(async (action: Action) => {
    const res = await fetch("/api/volunteers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    if (res.ok) setStore(await res.json());
    return res.ok;
  }, []);

  return { store, loaded, send };
}

/** A random id kept on this phone, so a volunteer sees their own shifts and requests without an account. */
export function useDevice() {
  const [deviceId, setDeviceId] = useState("");
  const [name, setNameState] = useState("");
  useEffect(() => {
    let id = "";
    try {
      id = localStorage.getItem("tbhm-device") ?? "";
      if (!id) { id = crypto.randomUUID(); localStorage.setItem("tbhm-device", id); }
      setNameState(localStorage.getItem("tbhm-name") ?? "");
    } catch { id = crypto.randomUUID(); }
    setDeviceId(id);
  }, []);
  const setName = (n: string) => { setNameState(n); try { localStorage.setItem("tbhm-name", n); } catch {} };
  return { deviceId, name, setName };
}
