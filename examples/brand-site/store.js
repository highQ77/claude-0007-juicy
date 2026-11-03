// 全域狀態：深色模式、手機選單、提示訊息
import { $ } from './core.js';

let toastTimer = null;

export const ui = $.store('ui', {
  state: () => ({
    dark: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    menuOpen: false,
    toast: null,
  }),
  actions: {
    toggleDark() {
      this.dark = !this.dark;
    },
    toggleMenu(open) {
      this.menuOpen = open === undefined ? !this.menuOpen : open;
    },
    notify(message) {
      this.toast = message;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (this.toast = null), 3500);
    },
  },
  persist: { key: 'lumio-ui', paths: ['dark'] }, // 只記住深色模式
});

// 深色模式：Tailwind 的 darkMode: 'class' 依 <html class="dark"> 切換
$.watch(() => ui.dark, (dark) => document.documentElement.classList.toggle('dark', dark), { immediate: true });
