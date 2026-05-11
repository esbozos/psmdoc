(function () {
    "use strict";

    var STORAGE_KEYS = {
        menu: "psm-menu-state",
        theme: "psm-theme",
        contrast: "psm-contrast",
        fontScale: "psm-font-scale",
    };

    var root = document.documentElement;
    var body = document.body;

    function getMenuStorageKey() {
        var parts = window.location.pathname.split("/").filter(Boolean);
        var base = parts.slice(0, 2).join("/");
        return STORAGE_KEYS.menu + ":" + (base || "root");
    }

    function slugifyText(text) {
        return String(text || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }

    function getSummaryText(detailsEl) {
        var first = detailsEl.firstElementChild;
        if (first && first.tagName === "SUMMARY") {
            return first.textContent || "";
        }
        var summary = detailsEl.querySelector("summary");
        return summary ? summary.textContent || "" : "";
    }

    function buildMenuId(detailsEl, index) {
        var pathParts = [];
        var node = detailsEl;
        while (node && node.tagName === "DETAILS") {
            var label = getSummaryText(node);
            var slug = slugifyText(label) || "dir";
            pathParts.unshift(slug);
            node = node.parentElement ? node.parentElement.closest("details") : null;
        }
        var pathId = pathParts.join("/");
        return pathId ? pathId + "-" + index : "dir-" + index;
    }

    function initMenuState() {
        var menuRoot = document.querySelector(".psm-sidebar");
        if (!menuRoot) {
            return;
        }

        var detailsNodes = Array.prototype.slice.call(menuRoot.querySelectorAll("details"));
        if (!detailsNodes.length) {
            return;
        }

        detailsNodes.forEach(function (detailsEl, index) {
            if (!detailsEl.dataset.menuId) {
                detailsEl.dataset.menuId = buildMenuId(detailsEl, index);
            }
        });

        var stateKey = getMenuStorageKey();

        function restoreState() {
            var raw = localStorage.getItem(stateKey);
            if (!raw) {
                return;
            }
            try {
                var opened = JSON.parse(raw) || [];
                detailsNodes.forEach(function (detailsEl) {
                    if (opened.indexOf(detailsEl.dataset.menuId) !== -1) {
                        detailsEl.open = true;
                    }
                });
            } catch (e) {
                // ignore invalid payload
            }
        }

        function saveState() {
            var opened = detailsNodes
                .filter(function (detailsEl) {
                    return detailsEl.open;
                })
                .map(function (detailsEl) {
                    return detailsEl.dataset.menuId;
                });
            localStorage.setItem(stateKey, JSON.stringify(opened));
        }

        detailsNodes.forEach(function (detailsEl) {
            detailsEl.addEventListener("toggle", saveState);
        });

        restoreState();

        var currentPath = window.location.pathname.replace(/\/$/, "");
        var activeLink = menuRoot.querySelector('a[href="' + currentPath + '"]');
        if (!activeLink) {
            activeLink = menuRoot.querySelector('a[href="' + currentPath + '/"]');
        }

        if (!activeLink) {
            return;
        }

        var parent = activeLink.closest("details");
        while (parent) {
            parent.open = true;
            parent = parent.parentElement ? parent.parentElement.closest("details") : null;
        }
        saveState();
    }

    function initMobileSidebar() {
        var toggle = document.getElementById("psm-mobile-nav-toggle");
        if (!toggle) {
            return;
        }

        function setOpen(open) {
            body.classList.toggle("psm-sidebar-open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }

        toggle.addEventListener("click", function () {
            var isOpen = body.classList.contains("psm-sidebar-open");
            setOpen(!isOpen);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        });

        document.addEventListener("click", function (event) {
            var sidebar = document.getElementById("psm-sidebar");
            if (!sidebar || !body.classList.contains("psm-sidebar-open")) {
                return;
            }
            if (sidebar.contains(event.target) || toggle.contains(event.target)) {
                return;
            }
            setOpen(false);
        });
    }

    function applyTheme(theme) {
        var resolved = theme;
        if (theme === "auto") {
            var darkScheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
            resolved = darkScheme ? "dark" : "light";
        }
        root.setAttribute("data-psm-theme", resolved === "dark" ? "dark" : "light");

        var toggle = document.getElementById("psm-theme-toggle");
        if (toggle) {
            toggle.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
            toggle.textContent = resolved === "dark" ? "Claro" : "Oscuro";
        }
    }

    function initTheme() {
        var toggle = document.getElementById("psm-theme-toggle");
        var stored = localStorage.getItem(STORAGE_KEYS.theme) || "auto";
        applyTheme(stored);

        if (!toggle) {
            return;
        }

        toggle.addEventListener("click", function () {
            var current = localStorage.getItem(STORAGE_KEYS.theme) || "auto";
            var next = current === "dark" ? "light" : "dark";
            localStorage.setItem(STORAGE_KEYS.theme, next);
            applyTheme(next);
        });
    }

    function initContrast() {
        var toggle = document.getElementById("psm-contrast-toggle");
        var enabled = localStorage.getItem(STORAGE_KEYS.contrast) === "high";

        function applyContrast(state) {
            root.classList.toggle("psm-high-contrast", state);
            if (toggle) {
                toggle.setAttribute("aria-pressed", state ? "true" : "false");
            }
        }

        applyContrast(enabled);

        if (!toggle) {
            return;
        }

        toggle.addEventListener("click", function () {
            enabled = !enabled;
            localStorage.setItem(STORAGE_KEYS.contrast, enabled ? "high" : "normal");
            applyContrast(enabled);
        });
    }

    function clampFontScale(value) {
        return Math.max(0.9, Math.min(1.4, value));
    }

    function initFontScale() {
        var dec = document.getElementById("psm-font-decrease");
        var inc = document.getElementById("psm-font-increase");
        var reset = document.getElementById("psm-font-reset");

        var stored = parseFloat(localStorage.getItem(STORAGE_KEYS.fontScale) || "1");
        var scale = clampFontScale(isNaN(stored) ? 1 : stored);

        function applyScale(newScale) {
            scale = clampFontScale(newScale);
            root.style.setProperty("--psm-font-scale", String(scale));
            localStorage.setItem(STORAGE_KEYS.fontScale, String(scale));
        }

        applyScale(scale);

        if (inc) {
            inc.addEventListener("click", function () {
                applyScale(scale + 0.08);
            });
        }

        if (dec) {
            dec.addEventListener("click", function () {
                applyScale(scale - 0.08);
            });
        }

        if (reset) {
            reset.addEventListener("click", function () {
                applyScale(1);
            });
        }
    }

    function initVersionSwitcher() {
        var select = document.getElementById("psm-version-select");
        if (!select) {
            return;
        }

        select.addEventListener("change", function () {
            var projectPath = select.getAttribute("data-project-path") || "/";
            if (projectPath.indexOf("/preview/") === 0) {
                return;
            }
            var normalized = projectPath.replace(/\/+$/, "") + "/";
            var version = select.value || "";
            if (!version) {
                return;
            }
            window.location.href = normalized + version + "/";
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initMenuState();
        initMobileSidebar();
        initTheme();
        initContrast();
        initFontScale();
        initVersionSwitcher();
    });
})();
    // add event listener to psm-accordion-option
    
}