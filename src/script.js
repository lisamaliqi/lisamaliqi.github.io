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


    /* ---------- Reaction test ---------- */
    const pad = document.querySelector("[data-react-pad]");

    if (pad) {
        const labelEl = pad.querySelector("[data-react-label]");
        const hintEl = pad.querySelector("[data-react-hint]");
        const bestEl = document.querySelector("[data-react-best]");
        const liveEl = document.querySelector("[data-react-live]");
        const targetEl = document.querySelector("[data-react-target]");

        const STORE_KEY = "react-best";
        // The number in the markup stays the single source of truth.
        const target = Number(targetEl && targetEl.dataset.reactTarget) || 0;

        const MIN_WAIT = 900;
        const MAX_WAIT = 2400;

        let state = "idle";
        let timer = null;
        let goAt = 0;

        const readBest = () => {
            try {
                const raw = Number(localStorage.getItem(STORE_KEY));
                return Number.isFinite(raw) && raw > 0 ? raw : null;
            } catch (e) {
                return null;
            }
        };

        const writeBest = (ms) => {
            try {
                localStorage.setItem(STORE_KEY, String(ms));
            } catch (e) {
                /* private mode — the best just won't survive a reload */
            }
        };

        const paint = (next, label, hint) => {
            state = next;
            pad.dataset.state = next;
            labelEl.textContent = label;
            hintEl.textContent = hint;
        };

        // Outcomes are announced separately: a button's own label changing
        // is not reliably read out by screen readers.
        const announce = (message) => {
            if (liveEl) liveEl.textContent = message;
        };

        const showBest = (ms) => {
            if (bestEl) bestEl.textContent = ms === null ? "—" : ms + " ms";
        };

        const reset = () => {
            clearTimeout(timer);
            timer = null;
            paint("idle", "Click to start", "or press Enter");
        };

        const arm = () => {
            clearTimeout(timer);
            announce("");
            paint("waiting", "Wait for green…", "don't jump");
            timer = setTimeout(() => {
                timer = null;
                paint("go", "Click!", "");
                // Read the clock here rather than when the timer was set, so a
                // late-firing timeout doesn't inflate the score.
                goAt = performance.now();
            }, MIN_WAIT + Math.random() * (MAX_WAIT - MIN_WAIT));
        };

        const tooSoon = () => {
            clearTimeout(timer);
            timer = null;
            paint("early", "Too soon", "wait for green, then click");
            announce("Too soon — you clicked before the pad turned green.");
        };

        const measure = () => {
            const ms = Math.round(performance.now() - goAt);
            const previous = readBest();
            const isBest = previous === null || ms < previous;

            if (isBest) writeBest(ms);
            showBest(isBest ? ms : previous);

            // The pad keeps the lowercase hint voice; the announcement is
            // written as a sentence instead.
            let hint = "click to try again";
            let spoken = "";

            if (target && ms < target) {
                hint = "faster than me — nice";
                spoken = " Faster than my own best.";
            } else if (isBest) {
                hint = "new personal best";
                spoken = " A new personal best.";
            }

            paint("result", ms + " ms", hint);
            announce(ms + " milliseconds." + spoken);
        };

        const press = () => {
            if (state === "waiting") tooSoon();
            else if (state === "go") measure();
            else arm();
        };

        // pointerdown rather than click: waiting for the mouse to come back up
        // would add its own 50–100ms to every reading.
        pad.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            press();
        });

        pad.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            // Also stops the synthetic click, so a key press counts once.
            event.preventDefault();
            if (event.repeat) return;
            press();
        });

        // Tabbing or scrolling away mid-round would otherwise come back to a
        // pad that has been green for a while and record a nonsense time.
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && (state === "waiting" || state === "go")) reset();
        });

        showBest(readBest());
    }


    /* ---------- Current year ---------- */
    document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = String(new Date().getFullYear());
    });
})();
