import { useEffect } from "react";
import { useAuth } from "@clerk/expo";

import { logIn } from "../lib/revenuecat";

// Después de Clerk, el App User ID de RevenueCat tiene que ser identity.subject
// (users.clerkId). Sin esto el webhook no encuentra la fila de entitlements.
export function useRevenueCatLogin() {
  const { isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (!isSignedIn || !userId) {
      return;
    }
    void logIn(userId);
  }, [isSignedIn, userId]);
}
