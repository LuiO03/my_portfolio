// Auto-ajuste de altura para textareas (equivalente a field-sizing: content)
// Se aplica de forma global a todos los <textarea> del dashboard,
// con una transición suave en la altura.

function resizeTextarea(el) {
  if (!el) return;

  const style = window.getComputedStyle(el);
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;

  // Altura actual explícita (si no hay, usamos offsetHeight como punto de partida)
  const currentHeight = el.offsetHeight;

  // Desactivar altura automática para poder calcular el nuevo alto
  el.style.height = 'auto';
  el.style.overflowY = 'hidden';

  const newHeight = el.scrollHeight + borderTop + borderBottom;

  // Fijar la altura actual antes de cambiarla, para que la transición funcione
  el.style.height = currentHeight + 'px';

  // Forzar reflow
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;

  // Aplicar la nueva altura (esto sí se anima gracias al transition en CSS)
  el.style.height = newHeight + 'px';
}

export function initTextareaAutosize() {
  const applyAll = () => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((ta) => resizeTextarea(ta));
  };

  // Ajuste inicial
  applyAll();

  // Delegado para cambios de contenido
  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    resizeTextarea(target);
  });

  // Por si se insertan textareas dinámicamente (Livewire, AJAX, etc.)
  const observer = new MutationObserver((mutations) => {
    let shouldApply = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        shouldApply = true;
        break;
      }
    }
    if (shouldApply) {
      applyAll();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
