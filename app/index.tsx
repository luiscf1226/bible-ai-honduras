import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";

import { api } from "../convex/_generated/api";
import { AI_CONSENT_VERSION } from "../convex/users";

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
