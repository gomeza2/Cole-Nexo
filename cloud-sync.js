/* NEXO Phase 5 — user-initiated cloud snapshot sync.
 * This module never uploads automatically. It requires an explicit checkbox
 * and a button press; server-side optimistic concurrency prevents silent overwrites.
 */
(() => {
  "use strict";

  const PROJECT_URL = String(window.NEXO_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const PUBLIC_KEY = String(window.NEXO_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const configured = Boolean(PROJECT_URL && PUBLIC_KEY && /^https:\/\/.+\.supabase\.co$/.test(PROJECT_URL));
  const client = configured && window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(PROJECT_URL, PUBLIC_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      })
    : null;

  const MAX_SNAPSHOT_BYTES = 1500000;
  let currentUserId = "";
  let consented = false;
  let busy = false;
  let lastRemote = null;
  let mounted = false;
  let sessionKnown = false;

  const $ = (selector) => document.querySelector(selector);

  function setStatus(message, kind = "info") {
    const node = $("#nexo-cloud-sync-status");
    if (!node) return;
    node.textContent = String(message || "");
    node.dataset.kind = kind;
    node.classList.toggle("is-error", kind === "error");
    node.classList.toggle("is-success", kind === "success");
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map((key) =>
        JSON.stringify(key) + ":" + stableStringify(value[key])
      ).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function getBytes(value) {
    const serialized = JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(serialized).length;
    return new Blob([serialized]).size;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "fecha no disponible"
      : date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
  }

  function updateControls() {
    const checkbox = $("#nexo-cloud-consent");
    const enabled = Boolean(checkbox && checkbox.checked && consented && currentUserId && client && !busy);
    document.querySelectorAll("[data-cloud-action]").forEach((button) => {
      button.disabled = !enabled;
    });
    const upload = $('[data-cloud-action="upload"]');
    const download = $('[data-cloud-action="download"]');
    if (upload) upload.textContent = lastRemote && lastRemote.exists
      ? "Subir local y reemplazar copia nube"
      : "Guardar copia local en la nube";
    if (download) download.textContent = "Restaurar nube en este dispositivo";
  }

  function explainInitialState() {
    if (!configured) {
      setStatus("La nube todavía no está conectada. Primero completá la URL y la publishable key en community-config.js; no se cargó ni envió ningún dato.", "error");
    } else if (!client) {
      setStatus("No se pudo iniciar el cliente Supabase. Revisá que se cargue el SDK en index.html.", "error");
    } else if (!currentUserId) {
      setStatus("Iniciá sesión en la sección Comunidad. La copia personal no se consulta hasta que marques el consentimiento.", "info");
    } else {
      setStatus("La sesión está disponible. Marcá el consentimiento para habilitar la revisión manual de tu copia privada.", "info");
    }
  }

  function mount() {
    if (!$("#nexo-cloud-sync-panel")) return;
    mounted = true;
    const checkbox = $("#nexo-cloud-consent");
    consented = Boolean(checkbox && checkbox.checked);
    if (checkbox && !checkbox.dataset.cloudBound) {
      checkbox.dataset.cloudBound = "true";
      checkbox.addEventListener("change", () => {
        consented = checkbox.checked;
        if (!consented) {
          lastRemote = null;
          setStatus("Consentimiento apagado. No se lee ni se sube ninguna copia a la nube.", "info");
        } else if (currentUserId) {
          setStatus("Consentimiento activo sólo para esta pantalla. Elegí «Revisar copia» para consultar tu nube; no se sincroniza automáticamente.", "info");
        } else {
          setStatus("El consentimiento está marcado, pero primero tenés que iniciar sesión en Comunidad.", "error");
        }
        updateControls();
      });
    }
    updateControls();
    if (client && !sessionKnown) refreshSession().catch(() => {
      sessionKnown = false;
      currentUserId = "";
      explainInitialState();
      updateControls();
    });
    else explainInitialState();
  }

  async function refreshSession() {
    if (!client) return;
    const result = await client.auth.getSession();
    const id = result.data && result.data.session && result.data.session.user
      ? result.data.session.user.id : "";
    sessionKnown = true;
    if (id !== currentUserId) {
      lastRemote = null;
      consented = false;
      const checkbox = $("#nexo-cloud-consent");
      if (checkbox) checkbox.checked = false;
    }
    currentUserId = id;
    if (mounted && !consented) explainInitialState();
    updateControls();
  }

  function getSnapshotApi() {
    if (!window.NexoAppData || typeof window.NexoAppData.getSnapshot !== "function") {
      throw new Error("No está disponible el módulo local de datos.");
    }
    const snapshot = window.NexoAppData.getSnapshot();
    if (!snapshot || snapshot.product !== "NEXO" || snapshot.schemaVersion !== 1 ||
        !snapshot.state || typeof snapshot.state !== "object" ||
        !snapshot.local || typeof snapshot.local !== "object") {
      throw new Error("El formato local de la copia no es válido.");
    }
    if (getBytes(snapshot) > MAX_SNAPSHOT_BYTES) {
      throw new Error("La copia supera el límite de 1,5 MB. Exportá un JSON y revisá qué datos auxiliares necesitás conservar.");
    }
    return snapshot;
  }

  function normalizeRemote(value) {
    if (!value || typeof value !== "object") throw new Error("La respuesta de Supabase no tiene el formato esperado.");
    const version = Number(value.version);
    if (!Number.isSafeInteger(version) || version < 0) throw new Error("La versión de la copia no es válida.");
    if (value.exists && (!value.payload || value.payload.product !== "NEXO" || value.payload.schemaVersion !== 1)) {
      throw new Error("La copia guardada tiene una versión incompatible; no se aplicó ningún cambio.");
    }
    return {
      exists: value.exists === true,
      version,
      payload: value.payload || null,
      updated_at: value.updated_at || null
    };
  }

  async function fetchRemote() {
    if (!client || !currentUserId) throw new Error("Iniciá sesión en Comunidad antes de continuar.");
    const authResult = await client.auth.getUser();
    if (authResult.error || !authResult.data || !authResult.data.user ||
        authResult.data.user.id !== currentUserId) {
      currentUserId = "";
      lastRemote = null;
      updateControls();
      throw new Error("La sesión no se pudo validar con el servidor. Volvé a iniciar sesión en Comunidad.");
    }
    const result = await client.rpc("get_nexo_snapshot");
    if (result.error) throw new Error(errorText(result.error));
    const snapshot = normalizeRemote(result.data);
    lastRemote = snapshot;
    return snapshot;
  }

  function errorText(error) {
    const raw = String(error && (error.message || error.details || error.hint) || "");
    if (/42501|permission|authenticat/i.test(raw)) return "La cuenta no tiene permiso o la sesión venció. Revisá Auth y los permisos de las funciones de Fase 5.";
    if (/22023|snapshot|1\.5 MB|payload|format/i.test(raw)) return "La copia tiene un formato no válido o supera el límite de tamaño.";
    if (/function.*not exist|PGRST202|schema cache/i.test(raw)) return "Falta ejecutar supabase/phase5-sync.sql en este proyecto.";
    if (/fetch|network|failed to/i.test(raw)) return "No se pudo alcanzar Supabase. Revisá la conexión y la URL del proyecto.";
    return "Supabase rechazó la acción. Revisá el SQL de Fase 5 y los registros del proyecto.";
  }

  function requireConsent() {
    if (!configured || !client) {
      explainInitialState();
      return false;
    }
    if (!currentUserId) {
      setStatus("Iniciá sesión desde Comunidad antes de consultar tu copia privada.", "error");
      return false;
    }
    if (!consented || !$("#nexo-cloud-consent")?.checked) {
      setStatus("Marcá el consentimiento explícito antes de acceder a tu copia en la nube.", "error");
      return false;
    }
    return true;
  }

  async function reviewRemote() {
    if (!requireConsent()) return;
    setBusy(true, "Consultando la copia privada…");
    try {
      const snapshot = await fetchRemote();
      const local = getSnapshotApi();
      if (!snapshot.exists) {
        setStatus("No existe una copia en la nube para esta cuenta. Tu información local no cambió. Podés crear la primera copia con «Guardar copia local en la nube».", "success");
      } else {
        const same = stableStringify(local) === stableStringify(snapshot.payload);
        setStatus(
          "Copia encontrada · versión " + snapshot.version + " · actualizada " + formatDate(snapshot.updated_at) +
          (same ? ". Coincide con este dispositivo." : ". Los datos local y nube son distintos: elegí deliberadamente cuál conservar. No combinamos datos automáticamente."),
          same ? "success" : "info"
        );
      }
    } catch (error) {
      setStatus(error.message || "No se pudo consultar la copia.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLocal() {
    if (!requireConsent()) return;
    if (!lastRemote) {
      setStatus("Primero pulsá «Revisar copia». Así comprobamos la versión antes de escribir y evitamos sobrescrituras silenciosas.", "error");
      return;
    }
    setBusy(true, "Guardando la copia local…");
    try {
      const local = getSnapshotApi();
      const result = await client.rpc("save_nexo_snapshot", {
        p_expected_version: lastRemote.version,
        p_payload: local
      });
      if (result.error) throw new Error(errorText(result.error));
      const response = result.data;
      if (!response || response.saved !== true) {
        if (response && response.conflict) {
          lastRemote = normalizeRemote(response);
          setStatus("Conflicto detectado: la copia nube cambió desde la última revisión. No se sobrescribió. Revisá la nueva versión y elegí de nuevo.", "error");
          return;
        }
        throw new Error("Supabase no confirmó que la copia se guardó.");
      }
      lastRemote = normalizeRemote(response);
      setStatus("Copia guardada correctamente · versión " + lastRemote.version + ". No se activó sincronización automática.", "success");
    } catch (error) {
      setStatus(error.message || "No se pudo guardar la copia.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function restoreCloud() {
    if (!requireConsent()) return;
    if (!lastRemote) {
      setStatus("Primero pulsá «Revisar copia». La nube no se restaura sin revisar qué versión contiene.", "error");
      return;
    }
    setBusy(true, "Verificando la versión antes de restaurar…");
    try {
      const reviewedVersion = lastRemote.version;
      const latest = await fetchRemote();
      if (!latest.exists) {
        setStatus("No hay una copia en la nube para esta cuenta. Tus datos locales siguen intactos.", "error");
        return;
      }
      if (latest.version !== reviewedVersion) {
        setStatus("La copia nube cambió desde que la revisaste. No se restauró nada. Leé el estado nuevo y volvé a pulsar restaurar si esa es la versión que elegís.", "error");
        return;
      }
      if (!window.NexoAppData || typeof window.NexoAppData.applySnapshot !== "function") {
        throw new Error("No está disponible la restauración local de NEXO.");
      }
      const ok = window.NexoAppData.applySnapshot(latest.payload);
      if (!ok) throw new Error("No se pudo restaurar por completo. Revisá el almacenamiento local e intentá exportar/recuperar los datos.");
      setStatus("Copia nube restaurada en este dispositivo · versión " + latest.version + ". Se reemplazaron los datos locales incluidos en la copia; los registros locales auxiliares ausentes también se quitaron. Exportá antes una copia para poder volver atrás.", "success");
    } catch (error) {
      setStatus(error.message || "No se pudo restaurar la copia.", "error");
    } finally {
      setBusy(false);
    }
  }

  function setBusy(value, message) {
    busy = value;
    if (message) setStatus(message, "info");
    updateControls();
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cloud-action]");
    if (!button || !$("#nexo-cloud-sync-panel")) return;
    if (button.disabled) return;
    const action = button.dataset.cloudAction;
    if (action === "review") return reviewRemote();
    if (action === "upload") return uploadLocal();
    if (action === "download") return restoreCloud();
  });

  if (client) {
    client.auth.onAuthStateChange((_event, session) => {
      const id = session && session.user ? session.user.id : "";
      sessionKnown = true;
      if (id !== currentUserId) {
        lastRemote = null;
        consented = false;
        const checkbox = $("#nexo-cloud-consent");
        if (checkbox) checkbox.checked = false;
      }
      currentUserId = id;
      if (mounted && !consented) explainInitialState();
      updateControls();
    });
  }

  window.NexoCloudSync = Object.freeze({ mount });
  const observer = new MutationObserver(() => {
    if ($("#nexo-cloud-sync-panel")) mount();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
