/**
 * common.js — Shared utility library for all games
 * ─────────────────────────────────────────────────
 * Include in every game HTML with:
 *   <script src="common.js"></script>
 *
 * Provides:
 *  1. Auto-resize  — fits any screen / orientation automatically, no rotate message
 *  2. Spinner      — show/hide a loading spinner inside any container element
 *  3. Timer        — start / stop / reset / format a game timer
 *  4. Status       — show success / error / info messages
 *  5. Safe init    — runs your game's init function after DOM is ready
 */

(function (global) {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // 1. AUTO-RESIZE
    // Automatically scales the page to fill the screen in any
    // orientation without ever asking the user to rotate.
    // ═══════════════════════════════════════════════════════════════

    // Inject base responsive meta + CSS once
    (function injectBaseStyles() {
        // Make sure viewport meta is correct
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

        // Inject global responsive CSS
        const style = document.createElement('style');
        style.textContent = `
            /* ── Auto-resize base ── */
            html {
                width: 100%;
            }
            body {
                width: 100%;
                min-height: 100%;
            }

            /* ── Landscape: shrink padding/font so everything fits ── */
            @media (orientation: landscape) and (max-height: 500px) {
                h1, .game-title {
                    font-size: 18px !important;
                    margin-bottom: 5px !important;
                }
                .container, .game-container {
                    padding: 8px !important;
                }
                .controls, .game-controls {
                    margin-bottom: 6px !important;
                }
                .number-pad, .game-pad {
                    gap: 4px !important;
                    margin-top: 6px !important;
                }
                .sudoku-grid, .game-grid {
                    margin: 6px auto !important;
                }
            }

            /* ── Small phones (width < 360px) ── */
            @media (max-width: 360px) {
                h1, .game-title   { font-size: 20px !important; }
                .sudoku-cell      { font-size: 14px !important; }
                .number-pad button { font-size: 14px !important; }
                button            { padding: 6px 10px !important; font-size: 11px !important; }
            }

            /* ── Common spinner ── */
            .cjs-spinner-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                width: 100%;
                height: 100%;
                min-height: 200px;
                background: #f0f4ff;
                border-radius: 4px;
            }
            .cjs-spinner {
                width: 44px;
                height: 44px;
                border: 5px solid #d0d8f0;
                border-top-color: #667eea;
                border-radius: 50%;
                animation: cjs-spin 0.8s linear infinite;
            }
            @keyframes cjs-spin { to { transform: rotate(360deg); } }
            .cjs-spinner-text {
                font-size: 14px;
                font-weight: bold;
                color: #764ba2;
                letter-spacing: 0.03em;
            }
        `;
        document.head.appendChild(style);
    })();

    /**
     * AutoResize.init()
     * Call once in your game to enable dynamic resizing on orientation change.
     * Optionally pass a callback that runs after every resize.
     *
     * Usage:
     *   CommonUtils.AutoResize.init();
     *   CommonUtils.AutoResize.init(function() { redrawMyGrid(); });
     */
    const AutoResize = {
        _callback: null,

        init: function (callback) {
            this._callback = callback || null;
            this._apply();
            window.addEventListener('resize', () => this._apply());
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this._apply(), 350);
            });
        },

        _apply: function () {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const isLandscape = vw > vh;
            const isSmallLandscape = isLandscape && vh < 500;

            // Find the main container — support common class names
            const container = document.querySelector(
                '.container, .game-container, [data-game-container]'
            );

            if (container) {
                if (isSmallLandscape) {
                    // Landscape phone — make it wide and short
                    container.style.maxWidth = Math.min(vw * 0.99, 700) + 'px';
                    container.style.maxHeight = vh + 'px';
                    container.style.overflowY = 'auto';
                } else {
                    // Portrait or tablet landscape — normal sizing
                    container.style.maxWidth = '';
                    container.style.maxHeight = '';
                    container.style.overflowY = '';
                }
            }

            if (this._callback) this._callback({ vw, vh, isLandscape, isSmallLandscape });
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // 2. SPINNER
    // Show / hide a loading spinner inside any DOM element.
    // ═══════════════════════════════════════════════════════════════

    /**
     * Spinner.show(element, message?)
     *   Replaces the element's content with a spinner + optional message.
     *   Saves original content so it can be restored with hide().
     *
     * Spinner.hide(element)
     *   Restores the element's original content.
     *
     * Usage:
     *   CommonUtils.Spinner.show(document.getElementById('sudokuGrid'), '⏳ Generating…');
     *   CommonUtils.Spinner.hide(document.getElementById('sudokuGrid'));
     */
    const Spinner = {
        _originals: new WeakMap(),
        _origClasses: new WeakMap(),

        show: function (el, message) {
            if (!el) return;
            // Save original state
            this._originals.set(el, el.innerHTML);
            this._origClasses.set(el, el.className);

            const msg = message || '⏳ Loading…';
            el.innerHTML = `
                <div class="cjs-spinner-wrap">
                    <div class="cjs-spinner"></div>
                    <div class="cjs-spinner-text">${msg}</div>
                </div>`;
        },

        hide: function (el) {
            if (!el) return;
            if (this._originals.has(el)) {
                el.innerHTML = this._originals.get(el);
                this._originals.delete(el);
            }
            if (this._origClasses.has(el)) {
                el.className = this._origClasses.get(el);
                this._origClasses.delete(el);
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // 3. TIMER
    // Simple start/stop/reset timer with formatted display.
    // ═══════════════════════════════════════════════════════════════

    /**
     * Usage:
     *   const t = CommonUtils.Timer.create('timer');   // pass element id
     *   t.start();
     *   t.stop();
     *   t.reset();
     *   t.value   // current seconds
     */
    const Timer = {
        create: function (elementId) {
            let seconds = 0;
            let interval = null;
            const el = document.getElementById(elementId);

            function format(s) {
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            }

            function update() {
                if (el) el.textContent = format(seconds);
            }

            return {
                get value() { return seconds; },

                start: function () {
                    clearInterval(interval);
                    interval = setInterval(() => {
                        seconds++;
                        update();
                    }, 1000);
                },

                stop: function () {
                    clearInterval(interval);
                },

                reset: function () {
                    clearInterval(interval);
                    seconds = 0;
                    update();
                },

                format: function () {
                    return format(seconds);
                }
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // 4. STATUS MESSAGES
    // Show success / error / info in a status element.
    // ═══════════════════════════════════════════════════════════════

    /**
     * Usage:
     *   CommonUtils.Status.success('status', '🎉 You won!');
     *   CommonUtils.Status.error('status', 'Wrong answer!');
     *   CommonUtils.Status.clear('status');
     */
    const Status = {
        _get: function (id) {
            return typeof id === 'string' ? document.getElementById(id) : id;
        },
        success: function (id, msg) {
            const el = this._get(id);
            if (!el) return;
            el.textContent = msg;
            el.className = (el.className || '').replace(/\b(error|info)\b/g, '').trim();
            el.classList.add('success');
        },
        error: function (id, msg) {
            const el = this._get(id);
            if (!el) return;
            el.textContent = msg;
            el.className = (el.className || '').replace(/\b(success|info)\b/g, '').trim();
            el.classList.add('error');
        },
        info: function (id, msg) {
            const el = this._get(id);
            if (!el) return;
            el.textContent = msg;
            el.className = (el.className || '').replace(/\b(success|error)\b/g, '').trim();
            el.classList.add('info');
        },
        clear: function (id) {
            const el = this._get(id);
            if (!el) return;
            el.textContent = '';
            el.classList.remove('success', 'error', 'info');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // 5. SAFE INIT
    // Runs your game init function after DOM is fully ready.
    // ═══════════════════════════════════════════════════════════════

    /**
     * Usage:
     *   CommonUtils.ready(function() { newGame(); });
     */
    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    global.CommonUtils = {
        AutoResize,
        Spinner,
        Timer,
        Status,
        ready
    };

})(window);
