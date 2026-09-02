/* =============================================================
   Shared behaviour: clock, theme toggle, scroll reveal, year
   Every piece is optional — each guards on its own elements so
   the same file can be loaded by every page.
   ============================================================= */

(() => {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


    /* ---------- Local time in Malmö ---------- */
    const clockEl = document.querySelector("[data-clock]");

    if (clockEl) {
        const format = new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Europe/Stockholm",
            hour: "2-digit",
            minute: "2-digit",
        });

        const tick = () => {
            const next = format.format(new Date());
            // Only touch the DOM when the minute actually rolls over.
            if (clockEl.textContent !== next) clockEl.textContent = next;
        };

        tick();
        setInterval(tick, 1000);
    }


    /* ---------- Theme toggle ---------- */
    const toggles = document.querySelectorAll("[data-theme-toggle]");

    if (toggles.length) {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

        const effectiveTheme = () =>
            document.documentElement.dataset.theme ||
            (systemDark.matches ? "dark" : "light");

        const syncMeta = (theme) => {
            document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
                meta.content = theme === "dark" ? "#08081A" : "#F2F2F7";
                meta.removeAttribute("media");
            });
        };

        const apply = (theme) => {
            document.documentElement.dataset.theme = theme;
            syncMeta(theme);
            toggles.forEach((btn) => {
                btn.setAttribute("aria-label",
                    theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
            });
            try {
                localStorage.setItem("theme", theme);
            } catch (e) {
                /* private mode — the choice just won't survive a reload */
            }
        };

        // Label correctly on load without forcing a theme, so an untouched
        // page keeps following the operating system.
        toggles.forEach((btn) => {
            btn.setAttribute("aria-label",
                effectiveTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme");
            btn.addEventListener("click", () => {
                apply(effectiveTheme() === "dark" ? "light" : "dark");
            });
        });
    }


    /* ---------- Scroll reveal ---------- */
    const revealables = document.querySelectorAll(".reveal");

    if (revealables.length) {
        if (reducedMotion || !("IntersectionObserver" in window)) {
            revealables.forEach((el) => el.classList.add("is-visible"));
        } else {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

            revealables.forEach((el, i) => {
                // A short stagger so tiles settle in sequence rather than as a slab.
                el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`;
                observer.observe(el);
            });
        }
    }


    /* ---------- Current year ---------- */
    document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = String(new Date().getFullYear());
    });
})();
