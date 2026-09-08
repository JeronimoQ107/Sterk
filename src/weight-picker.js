export function openWeightPicker(current, onSave) {
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'weight-dialog';
  dialog.setAttribute('aria-labelledby', 'weight-title');
  dialog.innerHTML = `<form><h2 id="weight-title">Editar peso</h2><label class="manual-weight">Peso en libras<input inputmode="decimal" type="text" autocomplete="off" value="${String(current).replace('.', ',')}" autofocus></label><p class="weight-error" role="alert"></p><div class="weight-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">Guardar peso</button></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  const input = dialog.querySelector('input');
  input.focus(); input.select();
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    const raw = input.value.trim(), value = Number(raw.replace(',', '.'));
    if (!/^\d+(?:[.,]\d+)?$/.test(raw) || !Number.isFinite(value) || value < 0) {
      dialog.querySelector('.weight-error').textContent = 'Escribe un peso válido, igual o mayor que cero.';
      input.focus(); return;
    }
    dialog.close(); onSave(value);
  };
  dialog.addEventListener('close', () => { dialog.remove(); if (opener?.isConnected) opener.focus(); });
}
