/* NEXO PWA controls. This file contains no secrets and stores no personal data. */
(() => {
  "use strict";

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIOS = () =>
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  const installHelp = () => {
    if (isIOS()) {
      return "En iPhone o iPad, abrí NEXO en Safari, tocá Compartir y elegí “Agregar a pantalla de inicio”. Después confirmá con “Agregar”.";
    }
    if (/android/i.test(window.navigator.userAgent)) {
      return "En Chrome para Android, abrí el menú ⋮ y elegí “Instalar app” o “Añadir a pantalla de inicio”. El nombre puede variar según el navegador.";
    }
    return "Usá el icono de instalación de la barra de direcciones o el menú del navegador y elegí “Instalar NEXO” o “Crear acceso directo”. La opción depende del navegador.";
  };

  function initialisePwaUI() {
    const topActions = document.querySelector(".top-actions");
    if (!topActions || document.querySelector("#nexo-pwa-toggle")) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "nexo-pwa-toggle";
    toggle.className = "nexo-pwa-toggle";
    toggle.textContent = "↓ Instalar";
    toggle.setAttribute("aria-controls", "nexo-pwa-panel");
    toggle.setAttribute("aria-expanded", "false");

    const profile = topActions.querySelector("#profile-button");
    topActions.insertBefore(toggle, profile || null);

    const panel = document.createElement("section");
    panel.id = "nexo-pwa-panel";
    panel.className = "nexo-pwa-panel";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "nexo-pwa-title");
    panel.innerHTML = `
      <div class="nexo-pwa-panel-top">
        <span class="nexo-pwa-kicker">NEXO · TU ESPACIO</span>
        <button type="button" class="nexo-pwa-close" id="nexo-pwa-close" aria-label="Cerrar">×</button>
      </div>
      <h2 id="nexo-pwa-title">Llevá NEXO a tu pantalla de inicio</h2>
      <p id="nexo-pwa-help"></p>
      <p class="nexo-pwa-status" id="nexo-pwa-status" role="status">Preparando el acceso sin conexión…</p>
      <div class="nexo-pwa-actions">
        <button type="button" class="btn btn-dark" id="nexo-pwa-install-action">Instalar NEXO</button>
        <button type="button" class="nexo-pwa-dismiss" id="nexo-pwa-dismiss">Después</button>
      </div>`;
    document.body.appendChild(panel);

    const help = panel.querySelector("#nexo-pwa-help");
    const status = panel.querySelector("#nexo-pwa-status");
    const installAction = panel.querySelector("#nexo-pwa-install-action");
    let deferredPrompt = null;

    const setPanelOpen = (open) => {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("#nexo-pwa-close").focus({ preventScroll: true });
      else toggle.focus({ preventScroll: true });
    };

    const syncHelp = () => {
      help.textContent = installHelp();
      if (isStandalone()) {
        toggle.textContent = "✓ Instalada";
        toggle.disabled = true;
        installAction.hidden = true;
        help.textContent = "NEXO ya está abierta como app en este dispositivo.";
      } else if (deferredPrompt) {
        installAction.hidden = false;
        installAction.textContent = "Instalar NEXO";
      } else {
        installAction.hidden = true;
      }
    };

    toggle.addEventListener("click", () => {
      syncHelp();
      setPanelOpen(panel.hidden);
    });
    panel.querySelector("#nexo-pwa-close").addEventListener("click", () => setPanelOpen(false));
    panel.querySelector("#nexo-pwa-dismiss").addEventListener("click", () => setPanelOpen(false));
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setPanelOpen(false);
    });

    installAction.addEventListener("click", async () => {
      if (!deferredPrompt) {
        help.textContent = installHelp();
        return;
      }
      deferredPrompt.prompt();
      const chosen = await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      if (chosen && chosen.outcome === "accepted") {
        help.textContent = "Listo. Seguí las indicaciones del navegador para terminar la instalación.";
      }
      syncHelp();
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      syncHelp();
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      syncHelp();
      status.textContent = "NEXO quedó instalada en este dispositivo.";
    });

    const updateConnectionStatus = () => {
      if (!window.navigator.onLine) {
        status.textContent = "Estás sin conexión. Los archivos guardados pueden abrirse; las funciones que necesitan servicios externos no se actualizarán.";
      } else {
        status.textContent = "El acceso sin conexión se prepara después de una visita con internet. Los servicios externos pueden seguir necesitando conexión.";
      }
    };
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();
    syncHelp();

    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      window.addEventListener("load", async () => {
        try {
          await navigator.serviceWorker.register(new URL("./service-worker.js", document.baseURI), { scope: "./" });
          await navigator.serviceWorker.ready;
          status.textContent = navigator.onLine
            ? "La versión base quedó preparada para abrirse sin conexión después de esta visita."
            : "Sin conexión: se abrirá la versión guardada. Noticias y funciones conectadas pueden no estar disponibles.";
        } catch (error) {
          status.textContent = "El modo sin conexión no está disponible en este alojamiento. Podés seguir usando NEXO con internet.";
        }
      }, { once: true });
    } else {
      status.textContent = "Este navegador no admite el modo sin conexión de NEXO.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialisePwaUI, { once: true });
  } else {
    initialisePwaUI();
  }
})();
