import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";

import { api } from "../convex/_generated/api";

const AI_CONSENT_VERSION = "2026-08-25"; // Mantener sincronizado con convex/users.ts.

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.current);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) return <Redirect href="/splash" />;
  if (!currentUser) return null;
  const hasCurrentConsent =
    currentUser.aiConsentAt !== undefined && currentUser.aiConsentVersion === AI_CONSENT_VERSION;
  return <Redirect href={hasCurrentConsent ? "/home" : "/consentimiento-ia"} />;
}
