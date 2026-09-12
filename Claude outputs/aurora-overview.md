# توضیح کامل پروژه Aurora

## معرفی کلی

**Aurora** یک پلتفرم کامل و کاربردی (نه یک نمونه‌ی ناقص/mockup) برای کشف محتوای سرگرمی است: فیلم، سریال و موسیقی را در یک «گراف سلیقه» (taste graph) واحد ترکیب می‌کند و به‌جای اینکه فقط بگوید «هوش مصنوعی این را پیشنهاد داد»، دلیل هر پیشنهاد را به زبان ساده توضیح می‌دهد. کل استک — احراز هویت، دیتابیس PostgreSQL، جست‌وجو، موتور پیشنهاددهی، امتیازدهی، کتابخانه‌ی شخصی، آنبوردینگ و صفحات محتوا — واقعی و متصل به هم است.

پشته‌ی فنی:

| لایه | ابزار |
|---|---|
| فریم‌ورک | Next.js 16 (App Router + Turbopack + Server Components) |
| زبان | TypeScript (strict) |
| استایل | Tailwind CSS v4 + shadcn/ui (روی پرایمیتیوهای Base UI) |
| دیتابیس | PostgreSQL |
| ORM | Prisma 7 (با درایور adapter مخصوص pg) |
| احراز هویت | Auth.js (NextAuth) v5 — Credentials + گزینه‌ی Google OAuth |
| اعتبارسنجی | Zod |
| فرم‌ها | React Hook Form |
| مدیریت state سرور | TanStack Query |
| آیکون‌ها | lucide-react |
| تست واحد | Vitest |
| تست E2E | Playwright |

---

## ۱) فایل‌های ریشه‌ی پروژه (root)

| فایل | نقش |
|---|---|
| `package.json` | لیست وابستگی‌ها و اسکریپت‌های npm (`dev`, `build`, `test`, `db:seed`, `ai:verify` و...) |
| `package-lock.json` | قفل نسخه‌ی دقیق پکیج‌ها |
| `next.config.ts` | تنظیمات Next.js — از جمله غیرفعال‌کردن بهینه‌سازی سمت‌سرور تصاویر چون همه‌ی آرت‌ورک‌ها از picsum.photos می‌آیند |
| `tsconfig.json` / `tsconfig.tsbuildinfo` | تنظیمات TypeScript و کش build آن |
| `eslint.config.mjs` | قوانین Lint |
| `postcss.config.mjs` | پیکربندی PostCSS برای Tailwind v4 |
| `components.json` | تنظیمات shadcn/ui (مسیر کامپوننت‌ها، استایل و...) |
| `vitest.config.ts` | تنظیمات تست واحد |
| `playwright.config.ts` | تنظیمات تست E2E (خودش هم `npm run dev` را بالا می‌آورد اگر سروری روی پورت 3000 نباشد) |
| `docker-compose.yml` | یک سرویس Postgres 16 برای توسعه‌ی محلی (کاربر/پسورد/دیتابیس: aurora) |
| `.env` / `.env.example` | متغیرهای محیطی واقعی/نمونه: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, کلیدهای اختیاری TMDB/Spotify/AI |
| `.gitignore` | فایل‌های نادیده‌گرفته‌شده توسط Git |
| `README.md` | مستندات کامل پروژه (معماری، API، نحوه‌ی اجرا) |
| `AGENTS.md` / `CLAUDE.md` | یادداشتی خودکار از خود Next.js برای دستیارهای AI (هشدار درباره‌ی تغییرات breaking در این نسخه‌ی Next) |
| `prisma.config.ts` | مسیر و تنظیمات CLI پریزما (schema، seed) |
| `next-env.d.ts` | تایپ‌های خودکار Next.js (نباید دستی ویرایش شود) |
| `node_modules/` | پکیج‌های نصب‌شده |
| `.next/` | خروجی build/dev کش‌شده‌ی Next.js |
| `test-results/` | خروجی آخرین اجرای Playwright |
| `public/` | فایل‌های استاتیک عمومی |

---

## ۲) پایگاه‌داده — Prisma (`prisma/`)

- **`schema.prisma`**: مدل کامل داده روی Postgres. بخش‌های اصلی:
  - **Auth**: `User`, `Account`, `Session`, `VerificationToken` (جداول استاندارد Auth.js)
  - **پروفایل و سلیقه**: `Profile` (شامل کلیدهای حریم خصوصی مثل `isPublic`, `showRatingsPublicly`...)، `UserPreference` (تنوع پیشنهاد، ژانر/حالت بی‌صداشده، خالق‌های مخفی‌شده)، `UserGenre`، `UserArtist`
  - **کاتالوگ محتوا**: `Genre`, `Movie`, `TVShow`, `Episode`, `Artist`, `Album`, `Song`
  - **فعالیت کاربر**: `Rating`, `SavedItem`, `WatchHistory`, `ListeningHistory`, `UserContentInteraction`, `UserFeedback` (لاگ append-only هر اصلاحی که کاربر روی پیشنهادها می‌زند — مثل «کمتر مثل این»، قابل Undo)
  - **سازمان‌دهی**: `Collection`/`CollectionItem`, `Playlist`/`PlaylistItem`
  - **پیشنهاددهی و جست‌وجو**: `Recommendation` (کش امتیازهای محاسبه‌شده)، `SearchHistory`
  - رتبه‌بندی/ذخیره/تاریخچه به‌صورت **چندشکلی (polymorphic)** با enum به نام `ContentType` پیاده‌سازی شده‌اند تا یک جدول برای همه‌ی انواع محتوا کار کند.
- **`migrations/`**: چهار مایگریشن به ترتیب تاریخ ساخته شدن: راه‌اندازی اولیه، افزودن پرسونالیزیشن و دنبال‌کردن (Follow)، کنترل حریم خصوصی پروفایل، و لاگ فیدبک کاربر.
- **`seed.ts`**: کاتالوگ ساختگی (fictional) را از `src/lib/mock/seed-data.ts` می‌خواند و در دیتابیس seed می‌کند (بدون نیاز به هیچ کلید API).
- **`seed-lib.ts`**: توابع کمکی مشترک بین اسکریپت‌های seed (slugify، upsert فیلم/سریال/هنرمند/آلبوم، مدیریت کش ژانر).
- **`seed-live.ts`**: کاتالوگ را از منابع **واقعی** پر می‌کند — سریال از TVmaze، موسیقی از iTunes/Spotify/Deezer، فیلم از TMDB (در صورت وجود کلید). Idempotent است (با upsert بر اساس slug).
- **`seed-community.ts`**: چند حساب کاربری نمونه با رتبه‌بندی‌های واقعی می‌سازد تا ویژگی‌هایی مثل «تطبیق سلیقه» و «فعالیت دوستان» داده‌ی واقعی برای محاسبه داشته باشند.

---

## ۳) صفحات برنامه — `src/app/`

Next.js App Router با گروه‌بندی مسیرها:

### گروه `(auth)` — صفحات ورود/ثبت‌نام (چیدمان مشترک وسط‌چین)
`login`, `signup`, `forgot-password`, `reset-password`, و `layout.tsx` مخصوص همین گروه.

### گروه `(app)` — پوسته‌ی اصلی برنامه پس از ورود (سایدبار در دسکتاپ + نوار پایین در موبایل)
شامل صفحات: `home`, `discover`, `search`, `library` (با زیرصفحات `collections/[id]`, `playlists/[id]`, `ratings`)، `profile` (و `profile/settings`)، `recommendations`، و صفحات جزئیات محتوا: `movie/[slug]`, `show/[slug]`, `episode/[slug]`, `artist/[slug]`, `album/[slug]`, `song/[slug]`، و همچنین `u/[username]` (پروفایل عمومی کاربران دیگر). `loading.tsx` حالت لودینگ مشترک این گروه است.

### صفحات مستقل
- `src/app/onboarding/page.tsx`: ویزارد آنبوردینگ تمام‌صفحه (خارج از پوسته‌ی اصلی برنامه)
- `src/app/page.tsx`: لندینگ پیج بازاریابی («/»)
- `src/app/layout.tsx`: layout ریشه (فونت‌ها، تم، Providerها)
- `src/app/error.tsx` / `src/app/not-found.tsx`: صفحات خطای کلی و 404
- `src/app/globals.css`: استایل سراسری Tailwind

### مسیرهای API — `src/app/api/` (همه خروجی `{ data }` یا `{ error }` می‌دهند)

**هسته:**
| مسیر | کار |
|---|---|
| `register` | ساخت حساب |
| `auth/[...nextauth]` | هندلرهای Auth.js (ورود/خروج/کال‌بک) |
| `auth/forgot-password` / `auth/reset-password` | جریان کامل بازیابی رمز عبور |
| `search` + `search/history` | جست‌وجوی بین‌رسانه‌ای + تاریخچه |
| `recommendations` + `recommendations/one-pick` | پیشنهادهای شخصی‌سازی‌شده |
| `library` | آیتم‌های ذخیره‌شده |
| `ratings` | ثبت/حذف امتیاز + بازمحاسبه‌ی میانگین جامعه |
| `activity` | ثبت رویداد تماشا/گوش‌دادن |
| `onboarding` | ذخیره‌ی انتخاب‌های اولیه و ساخت تریت‌های سلیقه‌ای |
| `profile` | خواندن/ویرایش پروفایل |
| `collections`, `collections/[id]/items` | مجموعه‌ها |
| `playlists`, `playlists/[id]`, `playlists/[id]/items` | پلی‌لیست‌های موسیقی |
| `follow` | دنبال‌کردن کاربران |

**دسته‌ی `taste/*` (لایه‌ی «هویت سلیقه‌ای»، همه فقط GET/POST و همه نیازمند ورود):**
`dna` (DNA سرگرمی)، `identity` (آرکی‌تایپ سلیقه)، `evolution` (روند تغییر سلیقه در طول زمان)، `insights` (تغییرات محسوس اخیر)، `journal` (فید تاریخچه‌ی فعالیت)، `stats` (آمار خام)، `favorites` (محبوب‌ترین‌ها)، `mood-profile` + `mood-feedback` (پروفایل حالت/مود و اصلاح آن)، `matches` (تطبیق سلیقه با دیگران)، `activity` (فعالیت دوستان)، `surprise` (پیشنهاد غافلگیرکننده)، و کنترل‌های پرسونالیزیشن: `mute`، `dismiss`، `less-like-this`، `useful`، `undo`، `reset`.

**دسته‌ی `ai/*` (تولید بر پایه‌ی زبان طبیعی، روی داده‌ی واقعی کاربر — نه یک AI بیرونی):**
`mood-discover` (کشف بر اساس یک جمله‌ی توصیف‌کننده‌ی حال‌وهوا)، `playlist` + `playlist/save` (ساخت/ذخیره‌ی پلی‌لیست پیشنهادی از یک prompt)، `watchlist` + `watchlist/save` (همین کار برای فیلم/سریال).

---

## ۴) کامپوننت‌های React — `src/components/`

| زیرپوشه | محتوا |
|---|---|
| `ui/` | پرایمیتیوهای shadcn/ui روی Base UI: `button`, `dialog`, `alert-dialog`, `dropdown-menu`, `select`, `tabs`, `input`, `checkbox`, `switch`, `tooltip`, `popover`, `avatar`, `badge`, `progress`, `skeleton`, `sonner` (توست) و... — بلوک‌های ساختمانی پایه‌ی رابط کاربری |
| `auth/` | فرم‌های `login-form`, `signup-form`, `forgot-password-form`, `reset-password-form` |
| `brand/logo.tsx` | لوگوی برند Aurora (سه خط افق با شفافیت نزولی، بدون آیکون کلیشه‌ای) |
| `navigation/` | `app-shell` (ترکیب سایدبار+نوارپایین)، `sidebar`, `bottom-nav`, `nav-items` (لیست منو)، `theme-toggle` (روشن/تاریک)، `user-menu` |
| `content/` | `content-card`/`content-grid`/`content-row` (کارت و شبکه‌ی محتوا)، `cross-media-card`/`cross-media-section` (اتصال بین رسانه‌ها)، `ranked-list`, `section-header`, `star-rating` |
| `detail/` | `detail-actions` (ذخیره/اشتراک/تماشا/گوش‌دادن)، `genre-badges`, `why-recommended` (توضیح باز/بسته‌شونده‌ی دلیل پیشنهاد + دکمه‌های فیدبک) |
| `discover/filter-bar.tsx` | فیلترهای ژانر/نوع/مرتب‌سازی صفحه‌ی Discover |
| `home/` | `taste-summary-card` (درِ ورودی به پروفایل)، `tonights-pick` (پیشنهاد امشب) |
| `library/` | دیالوگ‌های AI-watchlist، شبکه‌ی آیتم‌های مجموعه، دیالوگ ساخت مجموعه، تب‌های کتابخانه |
| `playlists/` | دیالوگ افزودن به پلی‌لیست، دیالوگ پلی‌لیست با AI، ساخت پلی‌لیست، جزئیات پلی‌لیست (تغییر نام، حذف آهنگ) |
| `onboarding/onboarding-wizard.tsx` | ویزارد چندمرحله‌ای انتخاب نوع محتوا/ژانر/علاقه‌مندی/تنوع پیشنهاد |
| `profile/` | بزرگ‌ترین دسته — کارت‌های DNA سرگرمی، هویت سرگرمی، طیف‌های سلیقه، تطبیق سلیقه، آمار امتیازدهی، توزیع محتوا، بخش ژورنال، نکات هوش‌مصنوعی، دستاوردهای کشف، پیشنهاد «Surprise Me»، فرم تنظیمات و بخش حریم خصوصی، دکمه‌ی دنبال‌کردن، فعالیت دوستان و... |
| `search/search-experience.tsx` | تجربه‌ی کامل جست‌وجو (وضعیت خالی، نتایج، بدون‌نتیجه، تاریخچه) |
| `states/` | `empty-state`, `error-state` — کامپوننت‌های عمومی وضعیت خالی/خطا |
| `providers.tsx` | ترکیب Providerهای سراسری: `SessionProvider` (next-auth)، `ThemeProvider`، `QueryClientProvider` (TanStack Query) |

---

## ۵) منطق اصلی برنامه — `src/lib/`

### `lib/auth/`
- `auth.ts`: تنظیمات Auth.js — provider اعتبارنامه‌ای (ایمیل/رمز با bcrypt) + Google اختیاری + آداپتور Prisma.
- `session.ts`: `getCurrentUserId()` و کمک‌کننده‌ی سرور برای گرفتن سشن در Server Componentها و ریدایرکت کاربر مهمان.

### `lib/db/prisma.ts`
Singleton کلاینت Prisma با آداپتور `@prisma/adapter-pg` (جلوگیری از باز شدن چندباره‌ی اتصال در حالت dev).

### `lib/content/` — لایه‌ی پرسش از دیتابیس و نگاشت به DTO
- `queries.ts`: کوئری‌های پریزما → کارت‌های محتوای تایپ‌شده.
- `mappers.ts`: تبدیل رکوردهای Prisma (Movie/TVShow/...) به شکل یکسان `ContentCard`.
- `rating-aggregate.ts`: بازمحاسبه‌ی میانگین امتیاز جامعه پس از هر رتبه‌دهی.
- `relation-key.ts`: نگاشت نوع محتوا به نام فیلد FK چندشکلی (movieId/showId/...).
- `user-state.ts`: وضعیت کاربر نسبت به یک آیتم خاص (ذخیره شده؟ چه امتیازی داده؟).
- **`providers/`**: لایه‌ی آداپتور منابع محتوا — هر Provider (واقعی یا ساختگی) یک اینترفیس یکسان دارد:
  - `tmdb.ts` (فیلم واقعی، نیازمند کلید)، `mock.ts` (کاتالوگ ساختگی فیلم، بدون کلید)
  - `tvmaze.ts` (سریال واقعی، بدون کلید — پیش‌فرض)
  - `itunes.ts` (موسیقی واقعی، بدون کلید — پیش‌فرض)، `spotify.ts` (موسیقی واقعی با کلید Client Credentials)، `deezer.ts` (جایگزین با آرت‌ورک/ژانر واقعی‌تر)
  - `types.ts`: قراردادهای مشترک اینترفیس Providerها
  - `index.ts`: انتخاب بهترین Provider موجود برای هر دسته در لحظه‌ی seed کردن

### `lib/recommendations/` — موتور پیشنهاددهی (پایپ‌لاین ماژولار)
1. `signals.ts` — جمع‌آوری امتیازها، ذخیره‌ها، تاریخچه‌ی تماشا/گوش‌دادن، انتخاب‌های آنبوردینگ به نقشه‌های وزن‌دار ژانر/مود/هنرمند + عنوان‌های محبوب.
2. `contentBased.ts` — امتیازدهی بر اساس تشابه محتوا (ژانر+مود+هنرمند).
3. `collaborative.ts` — فیلترینگ مشارکتی آیتم‌به‌آیتم واقعی (نیازمند حداقل ۳ رأی‌دهنده‌ی مشترک).
4. `popularity.ts` — اولویت محبوبیت+تازگی، برای کاربر جدید یا به‌عنوان تای‌بریکر.
5. `hybrid.ts` — ترکیب سه سیگنال بالا با وزن‌دهی متغیر بر اساس میزان داده‌ی موجود از کاربر (کولد استارت ایمن).
6. `explanation.ts` / `reasons.ts` / `why-this.ts` — تولید دلیل قابل‌فهم انسانی برای هر پیشنهاد.
7. `index.ts` — `getRecommendationsForUser()` (پیشنهاد نهایی + کش در جدول Recommendation) و `getSimilarTo()` (برای «بیشتر شبیه این»).
8. `one-pick.ts` / `one-pick-select.ts` — انتخاب یک «پیشنهاد امشب» واحد.
9. `maturity.ts`, `traits.ts` — کمکی‌های اضافه برای بلوغ سیگنال و استخراج تریت.
10. فایل‌های `*.test.ts` — تست واحد Vitest برای هرکدام از این ماژول‌ها.

### `lib/taste/` — لایه‌ی «هویت سلیقه‌ای» (ویژگی‌های عمیق پروفایل)
هرکدام یک منبع داده‌ی واقعی و قابل‌اثبات محاسبه می‌کند، نه چیزی شبیه‌سازی‌شده:
- `dna.ts`: «DNA سرگرمی» — ژانر/مود/هنرمند محبوب با سطح اطمینان (strong/emerging/exploring).
- `identity.ts` + `identity-model.ts` + `identity-types.ts`: سیستم آرکی‌تایپ هویت سلیقه‌ای اختصاصی Aurora (نزدیک‌ترین تطبیق روی طیف‌های اندازه‌گیری‌شده، نه دسته‌بندی دلخواه) — طراحی‌شده تا از خطای «اثر بارنوم» (توصیف مبهمی که برای همه صادق است) دوری کند.
- `spectrums.ts`: محاسبه‌ی طیف‌های سلیقه (reach/breadth/tone/pace) از روی داده‌ی واقعی.
- `evolution.ts`: روند تغییر ژانر محبوب در بازه‌های زمانی.
- `insights.ts`: تغییرات محسوس اخیر در الگوی مصرف.
- `habits.ts`: عادت‌های واقعی (مثلاً «به یک خالق برمی‌گردد» یا «سریال را کامل می‌بیند») — فقط با شواهد کافی.
- `favorites.ts`: محبوب‌ترین فیلم/سریال/آلبوم/هنرمند/آهنگ.
- `journal.ts`: فید زمانی از تماشا/گوش‌دادن/امتیاز/ذخیره.
- `milestones.ts`: نقاط عطف واقعی (مثلاً «۱۰۰امین امتیاز») با تاریخ واقعی.
- `mood-profile.ts`: پروفایل حالت/مود با درصد سهم هر مود.
- `ratings-distribution.ts`: هیستوگرام واقعی امتیازهای کاربر.
- `stats.ts`: آمار کلی (تعداد فیلم دیده‌شده، ژانر برتر و...).
- `surprise.ts`: پیشنهاد «غافلگیرم کن» — خارج از قوی‌ترین ژانر ولی هنوز مرتبط.
- `discoveries.ts`: «کشف‌های اخیر» — محتوای خارج از ۳ ژانر برتر تاریخی کاربر.
- `taste-match.ts`: تطبیق سلیقه با کاربران دیگر (نمودار مقایسه‌ی ژانر به ژانر).
- `friends-activity.ts`: فید فعالیت دوستان/کاربران دنبال‌شده.
- `covers.ts`: موزاییک کاور واقعی برای مجموعه‌ها.
- `feedback.ts`: هسته‌ی سیستم فیدبک — ثبت/خنثی‌کردن (`undo`) «نه برای من»، «کمتر مثل این»، بی‌صداکردن ژانر/مود/خالق، ریست پرسونالیزیشن. همه چیز در جدول `UserFeedback` به‌صورت append-only ثبت می‌شود، نه حذف — تا قابل توضیح و برگشت باشد.
- `identity-model.test.ts`: تست واحد منطق تطبیق آرکی‌تایپ.

### `lib/ai/` — تولید بر پایه‌ی prompt طبیعی (بدون سرویس AI بیرونی — منطق قطعی روی داده‌ی واقعی)
- `prompt-parser.ts`: استخراج نیت از یک جمله (مود، ژانر، نوع محتوا، تعداد درخواستی).
- `mood-discovery.ts`: پیشنهاد چندرسانه‌ای بر اساس یک توصیف حالت.
- `playlist.ts` / `watchlist.ts`: تولید پیش‌نمایش پلی‌لیست/واچ‌لیست از prompt (ذخیره نمی‌شود تا وقتی کاربر تأیید کند؛ ذخیره‌سازی نهایی در روت‌های `save` انجام می‌شود).

### `lib/crossmedia/` — اتصال بین انواع رسانه
- `discovery.ts`: یافتن محتوای مرتبط بین فیلم/سریال/موسیقی بر اساس مود/ژانر مشترک.
- `explanations.ts`: انتخاب بهترین دلیل اتصال (`tasteAffinity`, `moodOverlapCount`) — رابطه‌ی مستقیم (schema-backed) همیشه از رابطه‌ی استنتاجی (سلیقه/مود) متمایز اعلام می‌شود.
- `types.ts`: تعریف انواع رابطه (`DIRECT_RELATIONSHIP`, `TASTE_BASED`, `MOOD_BASED`, `COMMUNITY_BASED`).

### `lib/validation/` — اسکیمای Zod
`auth.ts` (ورود/ثبت‌نام با قوانین رمز عبور قوی)، `content.ts` (نوع محتوا، امتیازدهی نیم‌ستاره‌ای)، `onboarding.ts`، `profile.ts` — به‌همراه تست واحد برای auth و content.

### `lib/api/`
- `client.ts`: `fetchJson` — رَپر fetch سمت کلاینت که خطای استاندارد API را پرتاب می‌کند.
- `response.ts`: هلپرهای پاسخ یکنواخت سمت سرور (`ok`, `created`, `noContent`, `apiError`, `unauthorized`, `notFound`, `handleApi` برای گرفتن خطاهای Zod/غیرمنتظره).

### بقیه‌ی `lib/`
- `mock/seed-data.ts`: کاتالوگ ساختگی اصلی (ژانرها، فیلم‌ها، سریال‌ها، هنرمندان، آلبوم‌ها) — کاملاً تخیلی، بدون عنوان واقعی.
- `utils.ts`: کمکی‌های عمومی (از جمله `cn` برای ترکیب کلاس Tailwind و `slugifyGenre`).

---

## ۶) React Hooks — `src/hooks/`

همه با TanStack Query نوشته شده‌اند و منطق fetch/mutate + toast خطا/موفقیت را کپسوله می‌کنند:
- `use-library.ts`: ذخیره/حذف آیتم در کتابخانه.
- `use-ratings.ts`: ثبت/گرفتن امتیازهای من.
- `use-collections.ts`: CRUD مجموعه‌ها.
- `use-playlists.ts`: CRUD پلی‌لیست‌ها.
- `use-activity.ts`: ثبت رویداد تماشا/گوش‌دادن.
- `use-is-client.ts`: تشخیص mount شدن در کلاینت (جلوگیری از hydration mismatch، مثلاً برای تم).

---

## ۷) نوع‌ها — `src/types/`
- `content.ts`: `ContentKind` (نوع محتوا سمت UI) و نگاشت‌های آن به enum پریزما و مسیر URL.
- `next-auth.d.ts`: گسترش تایپ‌های next-auth برای افزودن `id` به `session.user`.

## ۸) کد تولیدشده — `src/generated/prisma/`
خروجی خودکار `prisma generate` (کلاینت پریزما، مدل‌ها، enumها) — دستی ویرایش نمی‌شود.

---

## ۹) تست‌ها

- **واحد (Vitest)** — کنار همان فایل منطقی که تست می‌کنند (`*.test.ts` در `lib/recommendations`, `lib/taste`, `lib/validation`, `lib/crossmedia`).
- **E2E (Playwright)** در `e2e/`:
  - `critical-flow.spec.ts`: کل مسیر کاربر جدید (ثبت‌نام → آنبوردینگ → خانه → پیشنهاد → جزئیات → ذخیره → امتیاز → کتابخانه)
  - `auth.spec.ts`: رد رمز اشتباه، ورود درست، ریدایرکت مهمان، خروج
  - `search.spec.ts`, `collections.spec.ts`, `playlists.spec.ts`, `profile-privacy.spec.ts`, `personalization.spec.ts`, `taste-feedback.spec.ts`, `api-security.spec.ts`
  - `helpers.ts`: ابزار مشترک (`signUpAndSkipOnboarding`, `hideDevOverlay`)

---

## ۱۰) سایر

- **`scripts/verify-ai-key.ts`**: بررسی می‌کند که کلید `AI_API_KEY` واقعاً معتبر است یا نه — بدون چاپ خود کلید (redact کامل).
- **`docs/entertainment-identity-research.md`**: تحقیق و استراتژی UX پشت سیستم «هویت سرگرمی» — مقایسه‌ی محصولاتی مثل 16Personalities، Truity، MBTI برای طراحی یک سیستم صادقانه مبتنی بر رفتار واقعی به‌جای خوداظهاری.
- **`.claude/launch.json`**: تنظیمات مخصوص محیط توسعه با ابزار Claude.

---

## جمع‌بندی معماری

جریان کلی داده این‌طور است: **Providerهای محتوا** (واقعی یا ساختگی) → اسکریپت‌های **seed** آن‌ها را در **Postgres** (از طریق **Prisma**) می‌نشانند → صفحات و API روت‌ها فقط از دیتابیس می‌خوانند (هیچ‌کدام مستقیم به Provider بیرونی وصل نمی‌شوند) → لایه‌ی **`lib/content`** رکوردها را به `ContentCard` تبدیل می‌کند → لایه‌ی **`lib/recommendations`** و **`lib/taste`** از رفتار واقعی کاربر (امتیاز، ذخیره، تماشا) سیگنال می‌سازند → **کامپوننت‌ها** و **هوک‌ها** این داده را در UI نمایش می‌دهند و فیدبک کاربر را دوباره از طریق API به `UserFeedback`/`UserPreference` برمی‌گردانند — یک چرخه‌ی بسته‌ی قابل‌توضیح و بدون داده‌ی جعلی.
