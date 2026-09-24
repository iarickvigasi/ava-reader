export const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    document.removeEventListener("visibilitychange", notify);
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
