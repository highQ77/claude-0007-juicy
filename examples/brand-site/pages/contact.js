import { $, h, container, wait } from '../core.js';
import { SERVICES } from '../data.js';
import { ui } from '../store.js';
import SectionHeading from '../components/section-heading.js';

const BUDGETS = ['50 萬以下', '50–150 萬', '150 萬以上', '還不確定'];
const emptyForm = () => ({ name: '', email: '', company: '', service: SERVICES[0].title, budget: BUDGETS[0], message: '', agree: false });

export default $.component({
  name: 'ContactPage',
  data: () => ({ form: emptyForm(), errors: {}, sending: false, sent: false }),
  methods: {
    validate() {
      const f = this.form;
      const errors = {};
      if (!f.name) errors.name = '請填寫姓名';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.email = '請填寫正確的 Email';
      if (f.message.length < 10) errors.message = '請至少寫 10 個字，讓我們更了解你的需求';
      if (!f.agree) errors.agree = '請同意隱私權政策';
      this.errors = errors;
      return Object.keys(errors).length === 0;
    },
    async submit() {
      if (!this.validate()) return;
      this.sending = true;
      await wait(900); // 模擬送出
      this.sending = false;
      this.sent = true;
      ui.notify(`謝謝你，${this.form.name}！我們會在兩個工作天內回覆。`);
    },
    reset() {
      this.form = emptyForm();
      this.errors = {};
      this.sent = false;
    },
  },
  view: (vm) => {
    const input = 'mt-2 block w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:bg-stone-900 ';
    const border = (key) => (vm.errors[key] ? 'border-rose-400' : 'border-stone-300 dark:border-stone-700');
    const field = (key, label, control) =>
      h('label', 'block',
        h('span', 'text-sm font-medium', label),
        control,
        vm.errors[key] && h('span', 'mt-1 block text-xs text-rose-600', vm.errors[key])
      );

    return h('div', '',
      container('grid gap-16 py-20 sm:py-28 lg:grid-cols-5',
        h('div', 'lg:col-span-2',
          SectionHeading('Contact', '聊聊你的專案', '填寫表單或直接來信，我們會在兩個工作天內回覆。第一次諮詢免費。'),
          h('dl', 'mt-10 space-y-6 text-sm',
            [['Email', 'hello@lumio.example'], ['電話', '(02) 0000-0000'], ['地址', '台北市某某區光明路 100 號 3 樓'], ['營業時間', '週一至週五 10:00–18:00']]
              .map(([k, v]) => h('div', '', h('dt', 'text-stone-500', k), h('dd', 'mt-1 font-medium', v)))
          )
        ),
        h('div', 'lg:col-span-3',
          vm.sent
            ? h('div', 'rounded-2xl bg-emerald-50 p-10 text-center dark:bg-emerald-500/10').transition('fade').append(
              h('p', 'text-4xl', '🎉'),
              h('h2', 'mt-4 text-2xl font-bold', '已收到你的訊息'),
              h('p', 'mt-2 text-stone-600 dark:text-stone-400', `我們會寄信到 ${vm.form.email} 與你聯絡。`),
              h('button', 'mt-8 rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold hover:border-stone-900 dark:border-stone-700')
                .attr('type', 'button').text('再填一份').on('click', vm.reset)
            )
            : h('form', 'grid gap-6 rounded-2xl border border-stone-200 p-6 sm:grid-cols-2 sm:p-8 dark:border-stone-800')
              .attr('novalidate', true)
              .on('submit.prevent', vm.submit)
              .append(
                field('name', '姓名 *', h('input', input + border('name')).attr({ type: 'text', autocomplete: 'name' }).model('form.name', { trim: true })),
                field('email', 'Email *', h('input', input + border('email')).attr({ type: 'email', autocomplete: 'email' }).model('form.email', { trim: true })),
                field('company', '公司 / 品牌', h('input', input + border('company')).attr({ type: 'text', autocomplete: 'organization' }).model('form.company', { trim: true })),
                field('service', '想諮詢的服務', h('select', input + border('service')).model('form.service').append(
                  SERVICES.map((s) => h('option', '', s.title).attr('value', s.title))
                )),
                h('fieldset', 'sm:col-span-2',
                  h('legend', 'text-sm font-medium', '預算範圍'),
                  h('div', 'mt-2 flex flex-wrap gap-2',
                    BUDGETS.map((b) =>
                      h('label', 'cursor-pointer rounded-full border px-4 py-2 text-sm transition ' +
                        (vm.form.budget === b
                          ? 'border-stone-900 bg-stone-900 text-white dark:border-white dark:bg-white dark:text-stone-900'
                          : 'border-stone-300 hover:border-stone-900 dark:border-stone-700'),
                        h('input', 'sr-only').attr({ type: 'radio', name: 'budget', value: b }).model('form.budget'),
                        b
                      )
                    )
                  )
                ),
                h('div', 'sm:col-span-2',
                  field('message', '專案說明 *', h('textarea', input + border('message') + ' min-h-[140px]')
                    .attr('placeholder', '例如：我們是一間新創的茶飲品牌，想在明年春天推出新的品牌形象與官網……')
                    .model('form.message', { trim: true }))
                ),
                h('div', 'sm:col-span-2',
                  h('label', 'flex items-start gap-3 text-sm',
                    h('input', 'mt-0.5 h-4 w-4 rounded border-stone-300 accent-amber-500').attr('type', 'checkbox').model('form.agree'),
                    h('span', '', '我同意拾光設計依隱私權政策使用以上資料與我聯絡')
                  ),
                  vm.errors.agree && h('span', 'mt-1 block text-xs text-rose-600', vm.errors.agree)
                ),
                h('div', 'sm:col-span-2',
                  h('button', 'w-full rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-stone-900')
                    .attr({ type: 'submit', disabled: vm.sending })
                    .text(vm.sending ? '送出中…' : '送出')
                )
              )
        )
      )
    );
  },
});
