// juicy.js 元件模組範例：$.import('./components/user-card.js')
// 匯出 ($) => 元件，模組本身不依賴全域 $，也能在打包工具裡使用
export default ($) =>
  $.component('user-card', {
    props: { name: '匿名', role: '' },
    emits: ['follow'],
    data: () => ({ following: false }),
    methods: {
      toggle() {
        this.following = !this.following;
        this.$emit('follow', this.name, this.following);
      },
    },
    view: (vm) =>
      $('div.user-card').append(
        $('span.avatar').text(vm.name.slice(0, 1)),
        $('div').append($('b').text(vm.name), vm.role && $('small').text(vm.role)),
        $('button').text(vm.following ? '✓ 已追蹤' : '＋ 追蹤').addClass({ on: vm.following }).on('click', vm.toggle)
      ),
  });
