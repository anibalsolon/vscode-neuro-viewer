export function message(el: HTMLElement, msg?: string): void {
  if (!msg) {
    el.style.display = 'none';
  } else {
    el.style.display = '';
    el.innerHTML = msg;
  }
}