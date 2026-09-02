/* =============================================================
   Theme lab — retheme this site in the browser.

   The whole site is painted from a handful of CSS custom
   properties on :root. This panel writes to those same
   properties inline, which beats every stylesheet rule, so a
   change lands on the next frame with no reload and no rebuild.

   Five primitives go in — accent hue, accent chroma, canvas
   lightness, neutral tint, corner radius — and the full token
   set is derived from them, the same way the stylesheet does it
   by hand. "Copy the CSS" prints the result as a :root block.
   ============================================================= */

(() => {
    "use strict";

    const root = document.documentElement;
    const STORE = "theme-lab";

    /* ---------- Control state ---------- */

    // Reproduces the shipped light theme.
    const LIGHT = { accentH: 249, accentS: 88, canvasL: 95, tint: 16, radius: 26 };
    // Reproduces the shipped dark theme.
    const DARK  = { accentH: 258, accentS: 93, canvasL: 7,  tint: 20, radius: 26 };

    const PRESETS = [
        { name: "Violet",   c: LIGHT },
        { name: "Midnight", c: DARK },
        { name: "Paper",    c: { accentH: 18,  accentS: 74, canvasL: 96, tint: 12, radius: 4  } },
        { name: "Sea",      c: { accentH: 189, accentS: 82, canvasL: 12, tint: 18, radius: 20 } },
        { name: "Moss",     c: { accentH: 142, accentS: 46, canvasL: 94, tint: 10, radius: 32 } },
        { name: "Rose",     c: { accentH: 340, accentS: 78, canvasL: 9,  tint: 14, radius: 14 } },
    ];

    const SLIDERS = [
        { key: "accentH", label: "Accent hue",    min: 0, max: 360, step: 1, unit: "°" },
        { key: "accentS", label: "Accent chroma", min: 0, max: 100, step: 1, unit: "%" },
        { key: "canvasL", label: "Canvas",        min: 4, max: 97,  step: 1, unit: "%" },
        { key: "tint",    label: "Neutral tint",  min: 0, max: 24,  step: 1, unit: "%" },
        { key: "radius",  label: "Corner radius", min: 0, max: 34,  step: 1, unit: "px" },
    ];

    // Chips under the sliders — the tokens worth watching move.
    const WATCH = ["--bg", "--surface", "--text", "--accent", "--accent-hi", "--mint"];

    // Emission order for the copied stylesheet.
    const ORDER = [
        "--bg", "--bg-grad", "--surface", "--surface-hi", "--surface-sunk",
        "--line", "--line-strong",
        "--text", "--text-2", "--text-3",
        "--accent", "--accent-hi", "--accent-soft", "--accent-line", "--mint", "--on-accent",
        "--shadow-sm", "--shadow-lg",
        "--r-lg", "--r-md", "--r-sm",
    ];


    /* ---------- Colour helpers ---------- */

    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

    /* h 0–360, s/l 0–100 → [r, g, b] 0–255 */
    const hslToRgb = (h, s, l) => {
        h = ((h % 360) + 360) % 360;
        s = clamp(s, 0, 100) / 100;
        l = clamp(l, 0, 100) / 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
    };

    const hex = (h, s, l) =>
        "#" + hslToRgb(h, s, l).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

    const rgba = (h, s, l, a) =>
        `rgba(${hslToRgb(h, s, l).join(", ")}, ${Math.round(a * 100) / 100})`;

    /* Relative luminance — the whole ramp is built off contrast, not vibes. */
    const luminance = (h, s, l) => {
        const [r, g, b] = hslToRgb(h, s, l).map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const ratio = (l1, l2) =>
        (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);


    /* ---------- The derivation: 5 primitives → 21 tokens ---------- */

    const derive = (c) => {
        const h = c.accentH;
        const L = c.canvasL;
        const aS = c.accentS;

        // Dark surfaces carry saturation far better than light ones — but only
        // while they stay dark. Taper it off toward mid-grey, where a saturated
        // surface eats the contrast the text needs.
        const nS = L < 50
            ? c.tint * (1 + 1.6 * Math.pow(1 - L / 50, 1.5))
            : c.tint;

        // Text sits on surfaces, not on the canvas, so the light-vs-dark
        // decision is made from the surface luminance — probed at the exact
        // saturation the surface will use. 0.1791 is the crossover where black
        // and white text contrast equally: sqrt(0.05 × 1.05) − 0.05.
        const dark = luminance(h, nS * 0.85, Math.min(L + 5, 100)) < 0.1791;

        // Push the text ramp further out as the canvas nears mid-grey, where
        // there is the least contrast to be had in either direction — all the
        // way to true black or white, tint and all, at the very middle.
        const edge = clamp(Math.abs(L - 50) / 26, 0, 1);
        const textL = dark ? clamp(94 + (L - 8) * 0.3, 94, 100)
                           : clamp(11 - (92 - L) * 0.3, 0, 11);
        const textS = Math.min(nS * 0.9, dark ? 26 : 20) * edge;

        // Secondary text keeps a fixed distance down the ramp from --text, so
        // it degrades with it rather than stranding at a fixed lightness — and
        // walks back toward --text if that distance costs it too much contrast.
        const surfLum = luminance(h, nS * 0.85, dark ? L + 5.5 : Math.min(L + 5, 100));
        const fit = (l, min) => {
            const step = dark ? 2 : -2;
            let out = l;
            for (let i = 0; i < 24 && ratio(luminance(h, textS, out), surfLum) < min; i++) out += step;
            return clamp(out, 0, 100);
        };
        const text2L = fit(textL + (dark ? -18 : 22), 4.5);
        const text3L = fit(textL + (dark ? -36 : 41), 3);

        // Lines and soft fills are the text/accent colour at low alpha, so
        // they stay in key with whatever the canvas is doing.
        const lineA = dark ? 0.13 : 0.1;

        const accentL = dark ? 72 : 58;
        const accentLum = luminance(h, aS, accentL);
        // Ink or paper on the accent — whichever actually reads.
        const onAccent = ratio(accentLum, luminance(h, 40, 7)) >= ratio(accentLum, luminance(h, 12, 100))
            ? hex(h, 40, 7)
            : hex(h, 12, 100);

        // "Positive" stays green: it is a semantic token, not a decorative one.
        const mintH = 163;
        // The second gradient blob sits analogous to the accent.
        const gradH = (h + 48) % 360;

        const gradA = dark ? 0.22 : 0.5;
        const shadowH = dark ? 0 : h;
        const shadowS = dark ? 0 : 20;
        const shadowL = dark ? 0 : 12;

        return {
            "--bg": hex(h, nS, L),
            "--bg-grad":
                `radial-gradient(1150px 620px at 13% -11%, ${rgba(h, dark ? 70 : aS, dark ? 55 : 78, gradA)} 0%, transparent 61%), ` +
                `radial-gradient(900px 520px at 100% 1%, ${rgba(gradH, dark ? 45 : aS * 0.6, dark ? 40 : 82, gradA * 0.8)} 0%, transparent 57%)`,
            "--surface": hex(h, nS * 0.85, dark ? L + 5.5 : Math.min(L + 5, 100)),
            "--surface-hi": hex(h, nS * 0.85, dark ? L + 9.5 : Math.min(L + 8, 100)),
            "--surface-sunk": hex(h, nS, dark ? L + 2 : L - 3.5),

            "--line": rgba(h, textS, textL, lineA),
            "--line-strong": rgba(h, textS, textL, lineA * 1.9),

            "--text": hex(h, textS, textL),
            "--text-2": hex(h, textS * 0.85, text2L),
            "--text-3": hex(h, textS * 0.7, text3L),

            "--accent": hex(h, aS, accentL),
            "--accent-hi": hex(h, aS * (dark ? 1 : 0.92), dark ? accentL + 10 : accentL - 8),
            "--accent-soft": rgba(h, aS, accentL, dark ? 0.14 : 0.1),
            "--accent-line": rgba(h, aS, accentL, dark ? 0.36 : 0.28),
            "--mint": hex(mintH, dark ? 72 : 82, dark ? 67 : 34),
            "--on-accent": onAccent,

            "--shadow-sm":
                `0 1px 2px ${rgba(shadowH, shadowS, shadowL, dark ? 0.4 : 0.05)}, ` +
                `0 2px 8px ${rgba(shadowH, shadowS, shadowL, dark ? 0.3 : 0.04)}`,
            "--shadow-lg":
                `0 2px 6px ${rgba(shadowH, shadowS, shadowL, dark ? 0.35 : 0.04)}, ` +
                `0 16px 40px ${rgba(shadowH, shadowS, shadowL, dark ? 0.45 : 0.1)}`,

            "--r-lg": `${c.radius}px`,
            "--r-md": `${Math.round(c.radius * 0.62)}px`,
            "--r-sm": `${Math.round(c.radius * 0.38)}px`,
        };
    };


    /* ---------- Applying & persisting ---------- */

    const apply = (tokens) => {
        // Never write a missing token: "--surface: undefined" is invalid at
        // computed-value time and would drop the property to its initial value.
        ORDER.forEach((k) => {
            if (typeof tokens[k] === "string") root.style.setProperty(k, tokens[k]);
        });
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
            meta.content = tokens["--bg"];
            meta.removeAttribute("media");
        });
    };

    const clear = () => {
        ORDER.forEach((k) => root.style.removeProperty(k));
        try {
            localStorage.removeItem(STORE);
        } catch (e) {
            /* private mode */
        }
    };

    const save = (controls, tokens) => {
        try {
            localStorage.setItem(STORE, JSON.stringify({ controls, tokens }));
        } catch (e) {
            /* private mode — the mix just won't survive a reload */
        }
    };

    const load = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORE));
            // A mix saved by an older token set is no longer a whole theme —
            // drop it and let the stylesheet show through rather than paint
            // half a palette.
            const whole = parsed && parsed.controls && parsed.tokens &&
                ORDER.every((k) => typeof parsed.tokens[k] === "string");
            return whole ? parsed : null;
        } catch (e) {
            return null;
        }
    };


    /* ---------- Copyable stylesheet ---------- */

    const toCSS = (tokens) => {
        const pad = Math.max.apply(null, ORDER.map((k) => k.length)) + 1;
        const lines = ORDER.map((k) => `    ${(k + ":").padEnd(pad)} ${tokens[k]};`);
        return "/* Mixed in the browser in Lisa's theme lab — paste over :root */\n" +
            ":root {\n" + lines.join("\n") + "\n}\n";
    };

    const copy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // The clipboard API needs a secure context; fall back to a scratch field.
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try {
                ok = document.execCommand("copy");
            } catch (err) {
                ok = false;
            }
            ta.remove();
            return ok;
        }
    };


    /* ---------- Build the panel ---------- */

    // Every page puts the theme toggle where the lab belongs too.
    const anchor = document.querySelector("[data-theme-toggle]");
    if (!anchor) return;

    const svg = (path) =>
        '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "icon-btn lab-launch";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "theme-lab");
    launcher.setAttribute("aria-label", "Open the theme lab");
    launcher.innerHTML = svg(
        '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.4A4.3 4.3 0 0 0 21 11.3C21 6.7 16.9 3 12 3Z"/>' +
        '<circle cx="7.6" cy="11" r="1.1" fill="currentColor" stroke="none"/>' +
        '<circle cx="11" cy="7.2" r="1.1" fill="currentColor" stroke="none"/>' +
        '<circle cx="15.6" cy="8.4" r="1.1" fill="currentColor" stroke="none"/>'
    );
    anchor.parentNode.insertBefore(launcher, anchor);

    const swatchStyle = (c) => {
        const nS = c.canvasL < 50 ? Math.min(c.tint * 2.4, 60) : c.tint;
        return `--sw:${hex(c.accentH, c.accentS, c.canvasL < 50 ? 72 : 58)};` +
               `--sw-bg:${hex(c.accentH, nS, c.canvasL)}`;
    };

    const panel = document.createElement("aside");
    panel.className = "lab";
    panel.id = "theme-lab";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "lab-title");
    panel.innerHTML = `
        <div class="lab__head">
            <div>
                <p class="eyebrow" id="lab-title">Theme lab</p>
                <p class="lab__note">
                    This whole site is painted from custom properties on
                    <code>:root</code>. Move something.
                </p>
            </div>
            <button class="icon-btn lab__close" type="button" aria-label="Close the theme lab">
                ${svg('<path d="M6 6l12 12M18 6 6 18"/>')}
            </button>
        </div>

        <div class="lab__section">
            <p class="lab__label">Presets</p>
            <div class="lab__swatches" role="group" aria-label="Theme presets">
                ${PRESETS.map((p, i) => `<button class="lab__swatch" type="button" data-preset="${i}"
                        title="${p.name}" aria-label="${p.name}" style="${swatchStyle(p.c)}"></button>`).join("")}
            </div>
        </div>

        <div class="lab__section lab__fields">
            ${SLIDERS.map((s) => `<div class="lab__field">
                    <label for="lab-${s.key}">${s.label}
                        <span class="lab__out"><output id="lab-out-${s.key}" for="lab-${s.key}"></output>${s.unit}</span>
                    </label>
                    <input id="lab-${s.key}" type="range" data-control="${s.key}"
                           min="${s.min}" max="${s.max}" step="${s.step}">
                </div>`).join("")}
        </div>

        <div class="lab__section">
            <p class="lab__label">Resolved tokens</p>
            <ul class="lab__tokens">
                ${WATCH.map((t) => `<li>
                    <span class="lab__dot" data-dot="${t}"></span>
                    <code>${t}</code><b data-val="${t}"></b></li>`).join("")}
            </ul>
        </div>

        <div class="lab__actions">
            <button class="btn btn--primary lab__copy" type="button">Copy the CSS</button>
            <button class="btn btn--ghost lab__reset" type="button">Reset</button>
        </div>
        <p class="lab__status" role="status" aria-live="polite"></p>
    `;
    document.body.appendChild(panel);


    /* ---------- Wire it up ---------- */

    const inputs = {};
    panel.querySelectorAll("[data-control]").forEach((el) => {
        inputs[el.dataset.control] = el;
    });

    const outs = {};
    SLIDERS.forEach((s) => {
        outs[s.key] = panel.querySelector(`#lab-out-${s.key}`);
    });

    const statusEl = panel.querySelector(".lab__status");
    const copyBtn = panel.querySelector(".lab__copy");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const pageIsDark = () =>
        (root.dataset.theme || (systemDark.matches ? "dark" : "light")) === "dark";

    const saved = load();
    let state = saved ? Object.assign({}, LIGHT, saved.controls) : null;
    let active = Boolean(saved);

    // The pre-paint snippet in <head> applies whatever is in storage sight
    // unseen. Re-apply a whole mix here so the meta theme-colour agrees with
    // it — and sweep up after a partial one the snippet may have painted.
    if (saved) apply(saved.tokens);
    else clear();

    const sync = (persist) => {
        const tokens = derive(state);
        apply(tokens);
        active = true;

        SLIDERS.forEach((s) => {
            inputs[s.key].value = state[s.key];
            outs[s.key].value = state[s.key];
        });
        WATCH.forEach((t) => {
            panel.querySelector(`[data-dot="${t}"]`).style.background = tokens[t];
            panel.querySelector(`[data-val="${t}"]`).textContent = tokens[t];
        });

        if (persist !== false) save(state, tokens);
        return tokens;
    };

    const setStatus = (msg) => {
        statusEl.textContent = msg;
        clearTimeout(setStatus.timer);
        if (msg) setStatus.timer = setTimeout(() => { statusEl.textContent = ""; }, 2600);
    };

    const open = () => {
        // Start from the theme the visitor is already looking at.
        if (!state) state = Object.assign({}, pageIsDark() ? DARK : LIGHT);

        panel.hidden = false;
        launcher.setAttribute("aria-expanded", "true");
        launcher.setAttribute("aria-label", "Close the theme lab");
        sync(active);
        // Paint the panel at its start state before transitioning in.
        requestAnimationFrame(() => panel.classList.add("is-open"));
        inputs.accentH.focus();
    };

    const close = () => {
        panel.classList.remove("is-open");
        launcher.setAttribute("aria-expanded", "false");
        launcher.setAttribute("aria-label", "Open the theme lab");
        if (reducedMotion.matches) panel.hidden = true;
        else setTimeout(() => { if (!panel.classList.contains("is-open")) panel.hidden = true; }, 220);
        // The launcher is the only way in, so it is where focus belongs on the
        // way out — including when Escape closed the panel from a slider.
        launcher.focus();
    };

    launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
    panel.querySelector(".lab__close").addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !panel.hidden) close();
    });

    panel.querySelectorAll("[data-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const preset = PRESETS[Number(btn.dataset.preset)];
            state = Object.assign({}, preset.c);
            sync();
            setStatus(`${preset.name} applied.`);
        });
    });

    Object.keys(inputs).forEach((key) => {
        inputs[key].addEventListener("input", () => {
            state[key] = Number(inputs[key].value);
            sync();
        });
    });

    copyBtn.addEventListener("click", async () => {
        const ok = await copy(toCSS(derive(state)));
        copyBtn.textContent = ok ? "Copied ✓" : "Couldn't copy";
        setStatus(ok
            ? `${ORDER.length} tokens on the clipboard.`
            : "The browser blocked the clipboard — nothing was copied.");
        setTimeout(() => { copyBtn.textContent = "Copy the CSS"; }, 1800);
    });

    panel.querySelector(".lab__reset").addEventListener("click", () => {
        state = Object.assign({}, pageIsDark() ? DARK : LIGHT);
        sync(false);   // refresh the sliders and chips…
        clear();       // …then drop the overrides so the stylesheet shows through
        active = false;
        setStatus("Back to the shipped theme.");
    });

    // The sun/moon button still owns light-vs-dark. While a custom mix is live,
    // flip the canvas to the other end of the ramp — otherwise the stylesheet's
    // theme would change invisibly underneath the inline overrides.
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (!active || !state) return;
            state.canvasL = clamp(100 - state.canvasL, 5, 96);
            sync();
        });
    });
})();
