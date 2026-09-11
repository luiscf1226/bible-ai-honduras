// Mock de @clerk/expo para el harness de QA — sesión siempre iniciada.
export function ClerkProvider({ children }) {
  return children;
}
export function ClerkLoaded({ children }) {
  return children;
}
export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: "user_qa",
    getToken: async () => "qa-token",
    signOut: async () => {}
  };
}
export function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      status: "complete",
      create: async () => ({ error: null }),
      emailCode: {
        sendCode: async () => ({ error: null }),
        verifyCode: async () => ({ error: null })
      },
      finalize: async () => {}
    }
  };
}
export function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      status: "complete",
      create: async () => ({ error: null }),
      verifications: {
        sendEmailCode: async () => ({ error: null }),
        verifyEmailCode: async () => ({ error: null })
      },
      finalize: async () => {}
    }
  };
}
export function useUser() {
  return { isLoaded: true, isSignedIn: true, user: { id: "user_qa" } };
}
