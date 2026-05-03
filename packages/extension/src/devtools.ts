// Registers a "React Compiler" tab inside Chrome DevTools.
chrome.devtools.panels.create(
  "React Compiler",
  "",
  "panel.html",
  () => {
    /* panel created */
  },
);
