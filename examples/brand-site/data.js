// 網站內容（皆為虛構）
import { wait } from './core.js';

export const NAV = [
  { to: '/', label: '首頁' },
  { to: '/about', label: '關於我們' },
  { to: '/services', label: '服務' },
  { to: '/work', label: '作品' },
  { to: '/contact', label: '聯絡我們' },
];

export const STATS = [
  { value: 120, suffix: '+', label: '完成的品牌與網站專案' },
  { value: 9, suffix: ' 年', label: '品牌設計經驗' },
  { value: 36, suffix: '', label: '長期合作的客戶' },
  { value: 4, suffix: ' 座', label: '設計獎項' },
];

export const SERVICES = [
  {
    icon: '◎',
    title: '品牌識別',
    desc: '從品牌定位、命名到標誌與視覺系統，建立一致且容易被記住的品牌形象。',
    items: ['品牌策略工作坊', '標誌與字標設計', '色彩、字體與視覺識別規範'],
  },
  {
    icon: '▣',
    title: '網站設計與開發',
    desc: '以內容與轉換為核心規劃網站，兼顧美感、速度與後續維護的便利。',
    items: ['資訊架構與線框稿', '響應式網站設計', '前端開發、上線與數據追蹤'],
  },
  {
    icon: '◇',
    title: '產品介面設計',
    desc: '從使用者研究出發，把複雜的流程整理成直覺、好用的介面。',
    items: ['使用者訪談與易用性測試', '介面與互動設計', '設計系統與元件庫'],
  },
  {
    icon: '✦',
    title: '內容與攝影',
    desc: '用文字、影像與動態說好品牌故事，讓每個接觸點都有一致的語氣。',
    items: ['品牌文案與語氣指南', '商品與形象攝影', '社群素材與短影音'],
  },
];

export const PROCESS = [
  { step: '01', title: '了解', desc: '訪談、競品與使用者研究，找出真正要解決的問題。' },
  { step: '02', title: '策略', desc: '定義品牌定位、目標對象與成功指標，作為設計的依據。' },
  { step: '03', title: '設計', desc: '快速提案與迭代，每週同步進度，讓決策有憑有據。' },
  { step: '04', title: '上線', desc: '交付完整規範與檔案，上線後持續追蹤成效並優化。' },
];

export const FAQ = [
  { q: '一個品牌識別專案大約需要多久？', a: '依範圍不同，通常為 6–10 週，包含研究、提案、修正與規範製作。' },
  { q: '可以只委託網站設計，不含開發嗎？', a: '可以。我們會交付可直接開發的設計稿與元件規範，也能配合貴公司的工程團隊。' },
  { q: '報價如何計算？', a: '依專案範圍與時程估算，第一次諮詢免費，我們會在一週內提供詳細的提案與報價。' },
  { q: '上線之後還能協助維護嗎？', a: '提供月費制的網站維護與設計支援方案，也可以依需求單次委託。' },
];

export const CATEGORIES = ['全部', '品牌識別', '網站', '產品介面'];

export const WORKS = [
  {
    id: 'mountain-tea',
    title: '山嵐茶室',
    category: '品牌識別',
    year: 2025,
    gradient: 'from-emerald-400 to-teal-600',
    glyph: '茶',
    summary: '為百年茶園的新品牌重新定義年輕世代的喝茶方式。',
    challenge: '老茶園擁有好茶與好故事，但包裝與通路形象偏傳統，難以觸及 25–35 歲的消費者。',
    approach: '以「山間的霧」為核心意象，發展出流動的標誌與一套可延伸到包裝、門市與社群的視覺系統。',
    results: [
      { value: '+52%', label: '首年營收成長' },
      { value: '3 倍', label: '社群追蹤人數' },
      { value: '18', label: '延伸包裝品項' },
    ],
  },
  {
    id: 'floating-books',
    title: '浮島書店',
    category: '網站',
    year: 2024,
    gradient: 'from-sky-400 to-indigo-600',
    glyph: '書',
    summary: '獨立書店的線上選書與活動報名網站。',
    challenge: '活動資訊散落在各社群平台，讀者不容易找到選書與講座，報名也需要人工處理。',
    approach: '把選書、活動與會員整合成一個網站，首頁依季節主題策展，活動報名改為線上流程。',
    results: [
      { value: '+38%', label: '活動報名人數' },
      { value: '1.2 秒', label: '首頁載入時間' },
      { value: '-70%', label: '人工處理報名的時間' },
    ],
  },
  {
    id: 'good-sleep',
    title: '好眠寢具',
    category: '品牌識別',
    year: 2024,
    gradient: 'from-violet-400 to-fuchsia-600',
    glyph: '眠',
    summary: '把「睡得好」變成品牌的核心承諾。',
    challenge: '產品品質好，但與市場上的寢具品牌缺乏差異，價格競爭激烈。',
    approach: '以夜空的漸層與柔和的圓角語彙建立品牌個性，並把睡眠知識變成內容行銷的主軸。',
    results: [
      { value: '+27%', label: '平均客單價' },
      { value: '4.8', label: '顧客評價平均分數' },
      { value: '12', label: '睡眠知識專欄' },
    ],
  },
  {
    id: 'south-wind',
    title: '南風單車',
    category: '產品介面',
    year: 2023,
    gradient: 'from-amber-400 to-orange-600',
    glyph: '騎',
    summary: '單車租借 App 的租車與路線規劃體驗改版。',
    challenge: '租車流程需要 7 個步驟，新用戶常在綁定付款時放棄。',
    approach: '透過 15 場使用者訪談重新設計流程，把租車縮短為 3 步，並加入依體力推薦的路線。',
    results: [
      { value: '3 步', label: '完成租車（原本 7 步）' },
      { value: '+41%', label: '新用戶完成首次租借' },
      { value: '4.7', label: 'App 商店評分' },
    ],
  },
  {
    id: 'little-farm',
    title: '拾米小農',
    category: '網站',
    year: 2023,
    gradient: 'from-lime-400 to-green-600',
    glyph: '米',
    summary: '產地直送的訂閱制電商網站。',
    challenge: '小農產量不穩定，一般電商的庫存邏輯無法反映「當季、限量」的特性。',
    approach: '以「每月一箱」的訂閱制為核心，網站呈現產地故事與收成日誌，讓等待成為期待。',
    results: [
      { value: '2,300', label: '訂閱戶' },
      { value: '91%', label: '續訂率' },
      { value: '+64%', label: '回購營收' },
    ],
  },
  {
    id: 'run-academy',
    title: '慢跑學院',
    category: '產品介面',
    year: 2022,
    gradient: 'from-rose-400 to-red-600',
    glyph: '跑',
    summary: '跑步課程平台的課表與進度追蹤介面。',
    challenge: '學員常因課表太難或太簡單而中斷，教練也難以掌握每位學員的狀況。',
    approach: '設計可依每週回饋自動調整的課表，以及讓教練一眼看出學員狀態的儀表板。',
    results: [
      { value: '+35%', label: '課程完成率' },
      { value: '2 倍', label: '教練可服務的學員數' },
      { value: '-48%', label: '中途退訂' },
    ],
  },
];

export const TEAM = [
  { name: '林予安', role: '創意總監', bio: '10 年品牌設計經驗，喜歡把複雜的事說得簡單。', gradient: 'from-amber-400 to-rose-500' },
  { name: '陳以樂', role: '設計主管', bio: '擅長字體與視覺系統，收藏了 300 本設計書。', gradient: 'from-sky-400 to-indigo-500' },
  { name: '黃思妤', role: '前端工程師', bio: '相信好的網站要快、要好用，也要好維護。', gradient: 'from-emerald-400 to-teal-500' },
  { name: '吳柏翰', role: '專案經理', bio: '讓每個專案準時上線，也讓客戶隨時掌握進度。', gradient: 'from-violet-400 to-fuchsia-500' },
];

export const TIMELINE = [
  { year: '2016', text: '兩位設計師在台北的小公寓成立工作室。' },
  { year: '2018', text: '完成第 50 個品牌專案，團隊擴編至 8 人。' },
  { year: '2021', text: '成立數位產品團隊，開始承接 App 與介面設計。' },
  { year: '2024', text: '遷入有攝影棚的新工作室，提供內容與攝影服務。' },
];

export const TESTIMONIALS = [
  { quote: '他們真的花時間理解我們的茶園，最後的品牌讓老客人有共鳴，也吸引了年輕人。', name: '張老闆', title: '山嵐茶室 負責人' },
  { quote: '從第一次開會到上線只用了 10 週，每週的進度同步讓我們很安心。', name: '李經理', title: '浮島書店 營運經理' },
  { quote: '租車流程改版後，客服電話少了一半，新用戶也明顯變多。', name: '王產品長', title: '南風單車 產品負責人' },
];

// 模擬從 API 取得最新消息
export const fetchNews = async () => {
  await wait(700);
  return [
    { date: '2025-10-28', tag: '活動', title: '「品牌從名字開始」免費講座開放報名' },
    { date: '2025-09-15', tag: '作品', title: '山嵐茶室品牌識別獲得年度包裝設計獎' },
    { date: '2025-08-02', tag: '徵才', title: '徵求資深網站設計師一名' },
  ];
};
