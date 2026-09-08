export function openWeightPicker(current, onSave) {
  const opener = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "weight-dialog";
  dialog.setAttribute("aria-labelledby", "weight-title");
  // Keep the wheel bounded even when a backup contains an unusually large weight.
  const firstStep = Math.max(0, Math.floor(current / 2.5) - 100);
  const values = Array.from({ length: 201 }, (_, index) => (firstStep + index) * 2.5);
  if (!values.includes(current)) values.push(current);
  values.sort((a, b) => a - b);
  const display = (value) => String(value).replace(".", ",");
  dialog.innerHTML = `<h2 id="weight-title">Peso de la serie · lb</h2><p>Desliza en pasos de 2,5 lb o escribe el valor.</p><div class="wheel-frame"><div class="weight-wheel" role="listbox" aria-label="Peso en libras" tabindex="0">${values.map((value) => `<div role="option" aria-selected="${value === current}" data-weight="${value}">${display(value)}</div>`).join("")}</div></div><label class="manual-weight">Escribir valor<input inputmode="decimal" type="text" value="${display(current)}" autocomplete="off"></label><p class="weight-error" role="alert"></p><div class="weight-actions"><button data-cancel>Cancelar</button><button data-save>Guardar peso</button></div>`;
  document.body.append(dialog);
  dialog.showModal();
  const wheel = dialog.querySelector(".weight-wheel"), input = dialog.querySelector("input");
  const options = [...wheel.children];
  let index = values.indexOf(current), manual = false;
  const select = (next, scroll = false) => {
    index = Math.max(0, Math.min(values.length - 1, next));
    options.forEach((option, i) => option.setAttribute("aria-selected", String(i === index)));
    if (!manual) input.value = display(values[index]);
    if (scroll) wheel.scrollTop = index * 48;
  };
  wheel.scrollTop = index * 48;
  wheel.addEventListener("pointerdown", () => { manual = false; });
  wheel.addEventListener("wheel", () => { manual = false; }, { passive: true });
  wheel.addEventListener("scroll", () => { if (!manual) select(Math.round(wheel.scrollTop / 48)); });
  wheel.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); manual = false;
    select(event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1), true);
  });
  wheel.addEventListener("click", (event) => {
    const option = event.target.closest("[data-weight]");
    if (option) { manual = false; select(values.indexOf(Number(option.dataset.weight)), true); }
  });
  input.addEventListener("input", () => { manual = true; });
  dialog.querySelector("[data-cancel]").onclick = () => dialog.close();
  dialog.querySelector("[data-save]").onclick = () => {
    const raw = input.value.trim(), value = Number(raw.replace(",", "."));
    if (!/^\d+(?:[.,]\d+)?$/.test(raw) || !Number.isFinite(value) || value < 0) {
      dialog.querySelector(".weight-error").textContent = "Escribe un peso válido, igual o mayor que cero."; input.focus(); return;
    }
    dialog.close(); onSave(value);
  };
  dialog.addEventListener("close", () => { dialog.remove(); if (opener?.isConnected) opener.focus(); });
  wheel.focus();
}
