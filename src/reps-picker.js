import { showSheet } from './sheet.js';

export function openRepsPicker(current, onSave) {
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'weight-dialog';
  dialog.setAttribute('aria-labelledby', 'reps-title');
  dialog.innerHTML = `<form><h2 id="reps-title">Editar repeticiones</h2><label class="manual-weight">Repeticiones<input inputmode="numeric" type="number" min="0" max="999" step="1" autocomplete="off" value="${current}" autofocus></label><p class="weight-error" role="alert"></p><button class="ui-button" type="submit">Guardar</button><button class="ui-button-plain" type="button" data-cancel>Cancelar</button></form>`;
  document.body.append(dialog);
  showSheet(dialog);
  const input = dialog.querySelector('input');
  input.focus(); input.select();
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    if (!/^\d+$/.test(raw) || Number(raw) > 999) {
      dialog.querySelector('.weight-error').textContent = 'Escribe un número entero entre 0 y 999.';
      input.focus(); return;
    }
    dialog.close(); onSave(Number(raw));
  };
  dialog.addEventListener('close', () => { dialog.remove(); if (opener?.isConnected) opener.focus(); });
}
