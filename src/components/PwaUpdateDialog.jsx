import { Download, Loader2, RefreshCw } from "lucide-react";
import { Modal } from "./Shared.jsx";
import { BTN_PRIMARY, BTN_GHOST } from "./classes.js";
import { useModalClose } from "../hooks/useModalClose.js";

function UpdateActions({ updates, saving }) {
  const close = useModalClose();
  return (
    <div className="flex flex-wrap justify-end gap-2 mt-5">
      <button className={BTN_GHOST} onClick={close} disabled={updates.installing}>
        {updates.available ? "Más tarde" : "Cerrar"}
      </button>
      {updates.available ? (
        <button className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
          disabled={saving || updates.installing} onClick={() => updates.install(saving)}>
          {updates.installing ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
          {updates.installing ? "Actualizando…" : "Actualizar ahora"}
        </button>
      ) : updates.error && (
        <button className={BTN_PRIMARY} disabled={updates.checking} onClick={() => updates.check()}>Reintentar</button>
      )}
    </div>
  );
}

export function PwaUpdateDialog({ updates, saving }) {
  if (!updates.dialogOpen) return null;
  return (
    <Modal title={updates.available ? "Nueva versión disponible" : "Actualizaciones"}
      onClose={updates.dismiss} dismissOnBackdrop={!updates.installing}
      panelClassName="p-[22px] max-w-[400px]">
      <div className="text-body text-muted" aria-live="polite">
        {updates.available ? (
          <p className="m-0">Hay una nueva versión de Gastify lista. Actualiza ahora para usarla; la app se recargará.</p>
        ) : updates.checking ? (
          <p className="m-0 flex items-center gap-2"><RefreshCw size={16} className="spin" /> Buscando actualizaciones…</p>
        ) : updates.message ? <p className="m-0">{updates.message}</p> : null}
        {updates.error && <p className="text-expense mt-3 mb-0" role="alert">{updates.error}</p>}
        {saving && updates.available && <p className="mt-3 mb-0">Espera a que terminen de guardarse tus cambios para actualizar.</p>}
      </div>
      <UpdateActions updates={updates} saving={saving} />
    </Modal>
  );
}
