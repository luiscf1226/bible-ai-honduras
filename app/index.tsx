import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return null;
  }

  return <Redirect href={isAuthenticated ? "/home" : "/splash"} />;
}
