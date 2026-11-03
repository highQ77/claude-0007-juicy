import { $ } from '../core.js';

// 數字從 0 跑到目標值：CountUp({ to: 120, suffix: '+' })
export default $.component({
  name: 'CountUp',
  props: { to: 0, suffix: '' },
  data: () => ({ n: 0 }),
  mounted() {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 1200);
      this.n = Math.round(this.to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  },
  unmounted() {
    cancelAnimationFrame(this.frame);
  },
  view: (vm) => $('span').text(vm.n + vm.suffix),
});
