export function useSSO() {
  return {
    startSSOFlow: async () => ({ createdSessionId: "sess_qa" })
  };
}
