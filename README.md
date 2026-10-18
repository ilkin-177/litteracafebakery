# ☕ Littera Cafe & Bakery - Bakı

Tam hazır sayt: **front-end** (HTML + CSS + JS) və **backend** (Node.js).
Backend heç bir xarici paket tələb etmir - `npm install` **lazım deyil**.

## 1. Nə lazımdır?
- [Node.js](https://nodejs.org) (LTS, versiya 18 və ya yuxarı) - bir dəfə quraşdırın
- [VS Code](https://code.visualstudio.com)
- İnternet (Tailwind, şriftlər və şəkillər üçün)

Node.js-in quraşdırıldığını yoxlamaq: VS Code terminalında `node -v`

## 2. VS Code-da işə salmaq
1. ZIP faylını açın (Extract).
2. VS Code → **File → Open Folder** → `littera-cafe` qovluğunu seçin.
3. **Terminal → New Terminal** açın və yazın:
   ```bash
   npm start
   ```
4. Brauzerdə açın: **http://localhost:3000**
5. Dayandırmaq üçün terminalda `Ctrl + C`.

> İstəsəniz VS Code-da `F5` basaraq da işə sala bilərsiniz (`.vscode/launch.json` hazırdır).
> Kodu dəyişəndə avtomatik yenidən başlasın deyə: `npm run dev`
> Windows-da `start.bat` faylına iki dəfə klikləmək də kifayətdir.

## 3. Admin panel
**http://localhost:3000/admin** - rezervləri və sifarişləri görmək, statusunu dəyişmək.
İlk dəfə qurarkən `.env.example` faylını `.env` adı ilə kopyalayın və `ADMIN_PASSWORD` üçün öz güclü parolunuzu yazın. Server parol təyin edilmədən başlamır. `.env` faylını GitHub-a yükləməyin.

## 4. Qovluq strukturu
```
littera-cafe/
├── package.json
├── .env                      ← port və admin parolu
├── server/
│   └── server.js             ← backend (API + statik fayllar)
├── data/
│   ├── menu.json             ← MENYUNU BURADAN DƏYİŞİN
│   ├── books.json            ← kitablar
│   ├── reservations.json     ← masa rezervləri (avtomatik yazılır)
│   └── orders.json           ← sifarişlər (avtomatik yazılır)
└── public/                   ← front-end
    ├── index.html            ← əsas səhifə
    ├── admin.html            ← admin panel
    ├── css/style.css         ← bütün animasiyalar
    ├── js/
    │   ├── main.js           ← menyu, səbət, formlar
    │   ├── animations.js     ← slayder, tilt, scroll, lightbox ...
    │   ├── api.js, cart.js, ui.js, admin.js
    │   └── tailwind.config.js
    └── images/               ← animasiyalı SVG şəkillər (ehtiyat)
```

## 5. Menyuya yeni məhsul əlavə etmək
`data/menu.json` faylına yeni sətir əlavə edin (serveri yenidən başlatmağa ehtiyac yoxdur, səhifəni yeniləyin):
```json
{ "id": 9, "title": "Latte", "category": "coffee", "price": 5.2, "desc": "Yumşaq süd və espresso.", "badge": "Yeni", "img": "https://..." }
```
`category`: `coffee`, `sweets`, `breakfast`, `snacks`. `id` unikal olmalıdır.

## 6. Animasiyalar
Hero Ken Burns slayderi, uçuşan qəhvə dənələri, buxarlanan fincan, dəyişən söz, sayğaclar, scroll reveal,
3D tilt kartlar, parıltı (shine) və zoom effektləri, səbətə uçan şəkil, lightbox qalereya, scroll progress
bar, yuxarı qayıt düyməsi. Sistemdə "azaldılmış hərəkət" seçilibsə animasiyalar avtomatik azalır.

## 7. API
| Metod | Ünvan | Təsvir |
|-------|-------|--------|
| GET | `/api/menu` | menyu |
| GET | `/api/books` | kitablar |
| POST | `/api/reservations` | masa sifarişi |
| POST | `/api/orders` | səbət sifarişi (qiymət serverdə hesablanır) |
| GET/PATCH | `/api/admin/...` | admin (Bearer parol) |

## 8. Problemlər
- **Port məşğuldur** → `.env`-də `PORT=3001` yazın.
- **"Serverə qoşulmaq alınmadı"** → terminalda `npm start` işləməlidir.
- **Şəkillər görünmür** → internet yoxdursa avtomatik yerli SVG şəkillər göstərilir.
- **VS Code Live Server** ilə `public/index.html` açsanız da işləyir, amma `npm start` də açıq olmalıdır.
- Telefondan baxmaq üçün `.env`-də `HOST=0.0.0.0` yazın və kompüterin IP-si ilə açın (bu halda admin parolunu dəyişin!).

## 9. Vercel-də yerləşdirmə
Layihəni Vercel-ə Git repository kimi qoşub **Root Directory** olaraq layihənin kök qovluğunu seçin. Kökdəki `vercel.json` statik səhifələri və `/api/*` endpoint-lərini yönləndirir. Admin panel üçün Vercel layihəsinin **Settings → Environment Variables** bölməsində `ADMIN_PASSWORD` mühit dəyişənini təyin edin. Bu dəyişən təyin edilməsə belə, ictimai menyu və kitab API-ləri işləyir; yalnız admin API-ləri deaktiv qalır.

> Vercel serverless fayl sistemi daimi saxlanma üçün nəzərdə tutulmayıb. Rezervasiya və sifarişlərin deploy-lar və sorğular arasında etibarlı saxlanması üçün JSON faylları əvəzinə daimi verilənlər bazası qoşun.
