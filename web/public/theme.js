(function () {
  /* The site follows the system appearance. The toggle overrides it for this tab only. */
  try {
    window.localStorage.removeItem("warefeats-theme");
    var theme = window.sessionStorage.getItem("warefeats-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch (error) {
    /* Storage is unavailable; the system preference applies. */
  }
})();
