import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../../../convex/_generated/api";
import { readingWidgetDays, upcomingDates } from "./readingWidget";
import { getReadingWidgetLocked, subscribeReadingWidgetLocked } from "./readingWidgetPrivacy";
import { updateReadingWidget } from "./updateReadingWidget";
import { hondurasToday } from "./verseWidget";

/**
 * Le deja al widget "Tu lectura de hoy" (#184) las próximas dos semanas: qué
 * plan y qué lectura toca cada día, y la racha. Se repinta solo cuando cambian
 * los planes (Convex es reactivo: marcar un día como leído actualiza el
 * widget). Sin sesión, el widget queda en el aviso de abrir la app — no se
 * queda mostrando los datos de la cuenta anterior.
 */
export function useReadingWidgetSync() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [locked, setLocked] = useState<boolean | null>(null);
  const today = hondurasToday();
  const dates = useMemo(() => upcomingDates(today), [today]);

  const candidates = useQuery(api.readingPlans.reminderCandidates, isAuthenticated ? { dates } : "skip");
  const plans = useQuery(api.readingPlans.myPlans, isAuthenticated ? {} : "skip");

  useEffect(() => {
    let active = true;
    void getReadingWidgetLocked().then((value) => {
      if (active) setLocked(value);
    });
    const unsubscribe = subscribeReadingWidgetLocked(setLocked);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (locked === null || isLoading) return;
    if (!isAuthenticated) {
      void updateReadingWidget([], { locked }).catch(() => undefined);
      return;
    }
    if (!candidates || !plans) return;
    const streaks = plans.map((plan) => ({
      planId: plan.plan.id,
      currentStreak: plan.currentStreak,
      lastCompletedDate: plan.lastCompletedDate,
    }));
    void updateReadingWidget(readingWidgetDays(candidates, streaks, dates), { locked }).catch(() => undefined);
  }, [candidates, plans, dates, locked, isAuthenticated, isLoading]);
}
