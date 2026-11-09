# PROMPTIONAL

PROMPTIONAL adalah produk digital untuk membantu pelaku UMKM menemukan, menyusun, dan memakai prompt AI untuk pemasaran dan pembuatan konten. Pengguna memilih kebutuhan atau kategori bisnis, lalu menyalin prompt ke layanan AI pilihan mereka. Produk ini adalah perpustakaan prompt dan prompt builder—bukan layanan model AI atau jaminan penjualan.

## Alur bisnis

1. **Penemuan:** calon pengguna membuka landing page, melihat contoh, mencoba demo, atau mengikuti kanal sosial.
2. **Gratis:** pengguna dapat menekan **Start** di bot Telegram untuk menerima prompt gratis yang dijadwalkan admin. Ada juga halaman prompt publik individual dengan tautan `/ig/BPxxx`.
3. **Pembelian:** pengguna mengisi nama, WhatsApp, dan email lalu membayar melalui QRIS di website. Backend memeriksa status pembayaran ke BuatQRIS; status dari browser saja tidak dianggap bukti pembayaran.
4. **Aktivasi:** setelah pembayaran terverifikasi, backend mengaktifkan akun Member Area dan memberi akses Premium sesuai masa akses pesanan.
5. **Pemakaian:** member login ke Member Area untuk menelusuri koleksi prompt, memilih kategori, menyalin prompt, menyimpan favorit, melihat riwayat, dan memakai Profil Bisnis.
6. **Dukungan:** halaman Support dan admin membantu masalah akses, pembayaran, akun, dan pengelolaan konten.

## Penawaran yang tampak di source

- Landing utama menampilkan akses Premium **365 hari** dan checkout QRIS sebesar **Rp199.000**. Endpoint website mematok nominal ini di server dan memeriksa konfigurasi harga sebelum membuka checkout.
- `instagram.html` menampilkan penawaran launching **Rp87.000** dengan kode `LAUNCH10`; halaman ini memiliki antarmuka checkout sendiri dan memanggil Appwrite `payment-api` secara langsung. Periksa konfigurasi produk/kupon di backend sebelum memastikan nominal akhir yang dibayar.
- Bot Free mengirim konten yang dipilih admin dari kalender. Bot `/premium` mengarahkan pengguna ke pembelian melalui website; Premium membuka koleksi di Member Area, bukan kiriman prompt Premium harian.

**Penting sebelum memasarkan:** source masih memuat lebih dari satu harga dan jalur checkout. Verifikasi harga, kupon, konfigurasi Appwrite, status QRIS, domain kanonis, dan deployment Vercel yang aktif sebelum mengiklankan atau menerima pembayaran. README ini menjelaskan source yang diperiksa, bukan bukti bahwa setiap jalur sedang aktif di production.

## Konten dan sumber data

- Database Appwrite: `badai_prompt_umkm` pada project `badai-prompt-umkm`.
- Sumber prompt aktif bersama: tabel `scene_prompts`. Hanya konten terbit (`is_published=true`) dengan teks prompt yang valid tampil di Member Area/perpustakaan Telegram.
- Tabel lama `prompts` berisi template dari sistem terdahulu dan dipertahankan sebagai arsip; jangan menganggapnya sebagai katalog aktif atau menghapusnya tanpa kurasi dan persetujuan.
- Galeri landing publik hanya memakai preview yang telah diterbitkan. Endpoint preview tidak mengirim teks prompt Premium atau data member ke browser.
- Jumlah prompt bersifat dinamis. Ambil angka terbaru dari Admin/Appwrite sebelum menulis klaim jumlah ke materi pemasaran.

## Alur Telegram Free

- Pengguna memulai bot secara sukarela dengan `/start`. Bot mencatat persetujuan chat; bot tidak dapat memulai DM dengan orang yang belum membuka chat bot.
- Perintah utama: `/start`, `/prompt`, `/premium`, `/status`, dan `/bantuan`.
- Prompt Free hanya berasal dari kalender yang disusun admin untuk Hari 1–365. Hari kosong atau kalender DRAF dilewati—tidak ada rotasi/fallback otomatis.
- Jadwal memakai zona waktu WIB. Penghapusan pesan Free default-nya 24 jam (admin dapat memilih 1–36 jam pada kalender). Sistem mencatat ID pesan dan mencoba menghapusnya; batasan/API Telegram dapat membuat penghapusan gagal.
- Pengiriman memerlukan dua pengaman sekaligus: kalender diaktifkan oleh admin dan izin kirim sisi server `TELEGRAM_SEND_ENABLED`. Pengiriman otomatis tidak dianggap aktif hanya karena source code atau konten sudah ada.
- Bot Telegram tidak menerima checkout QRIS digital di dalam bot; pembelian Premium diarahkan ke website. Periksa ketentuan pembayaran Telegram sebelum menambah metode pembayaran di bot.

## Arsitektur

- **Frontend:** halaman HTML/CSS/JS di repo ini; Vercel menyajikan file statis, rewrite/redirect, serta route `/api/*`.
- **API website:** `api/form-checkout.js`, `api/website-checkout.js`, dan route lain memvalidasi input dan meneruskan operasi ke Appwrite Function/server-side. Kunci Appwrite/QRIS tidak boleh dikirim ke browser.
- **Backend/data:** Appwrite Auth, TablesDB, Teams, Storage, dan Functions. `functions/payment-api` menangani pembayaran/akses web; `functions/activate-member` menangani keanggotaan, masa akses, dan layanan Telegram; `functions/admin-api` berisi API admin generasi lama. Jangan menganggap semua folder Function otomatis menjadi endpoint Vercel—deployment/config Appwrite-nya terpisah.
- **Pembayaran:** BuatQRIS untuk invoice QRIS; webhook harus diverifikasi dan status pembayaran diperiksa ulang di provider sebelum akses diberikan.
- **Telegram:** webhook bot, konfigurasi admin, member linking, kalender konten, delivery log, dan penghapusan pesan berada di `api/telegram/` dan modul `functions/activate-member/src/telegram/`.

## Route penting

- `/` — landing utama dan checkout Premium.
- `/demo` — demo produk (route/berkas perlu disesuaikan dengan konfigurasi deployment saat ini).
- `/member` — Member Area/login.
- `/admin` — panel admin.
- `/instagram` — landing Instagram.
- `/ig/BPxxx` — halaman prompt gratis individual.
- `/privacy`, `/terms`, `/refund`, `/support` — halaman kebijakan dan bantuan.
- `/api/telegram/*` — route kesehatan, pengelolaan, linking, dan webhook Telegram.

`vercel.json` juga menyimpan route lama/alias, rewrite katalog publik, dan redirect domain lama. Pastikan domain utama dan alias yang dipakai produksi benar di Vercel; metadata halaman saat ini menyebut `promptional.vercel.app`, sedangkan beberapa konfigurasi lama masih memakai `badaiprompt.vercel.app`.

## Admin dan operasi konten

1. Buat atau tinjau prompt di Admin; terbitkan hanya setelah isi dan preview disetujui.
2. Di **Telegram → Konten**, pilih prompt terbit untuk slot kalender tertentu. Terbit saja tidak menjadwalkan pengiriman.
3. Atur tanggal mulai, jam WIB, template upsell/CTA, dan waktu penghapusan. Biarkan DRAF saat persiapan.
4. Gunakan fitur uji kirim hanya ke tester yang sudah diberi izin; periksa konten, CTA, dan perilaku hapus.
5. Aktifkan kalender dan server send gate hanya setelah token bot, webhook, izin, dan konfigurasi telah diverifikasi.

Token bot dan API key hanya dimasukkan ke secret manager/field admin resmi atau environment server yang terlindungi. Jangan taruh secret di Git, source frontend, screenshot, issue, atau chat. Jangan mengirim broadcast, mengubah status pembayaran/member, menghapus data pelanggan, atau mengaktifkan pengiriman live tanpa persetujuan owner.

## Struktur repo

- `index.html`, `instagram.html`, `demo.html`, `member.html`, `admin.html`, dan halaman kebijakan — antarmuka website.
- `checkout-frame.html` — checkout QRIS yang disematkan di landing utama.
- `api/` — route serverless website/Vercel dan relay ke Appwrite.
- `functions/` — source Appwrite Functions.
- `assets/` — CSS, JS, ikon, aset preview, dan SDK browser.
- `data/` — dataset/prompt untuk modul yang menggunakannya.
- `docs/` — catatan operasional, keputusan, audit, dan release gate; periksa tanggal/konteks karena sebagian dokumen adalah snapshot historis.
- `tests/`, `scripts/` — regression tests dan pemeriksaan source/UI.
- `vercel.json` — clean URLs, rewrites, dan redirects.

## Pengembangan lokal dan tes

Perlu Node.js. Server statis sederhana dapat dijalankan dengan:

```bash
npm start
```

Server tersebut hanya menyajikan file statis; ia **tidak** meniru serverless API Vercel, Appwrite Functions, login nyata, atau transaksi QRIS. Untuk menjalankan tes yang ditentukan di `package.json`:

```bash
npm test
npm run test:telegram-ui
npm run test:telegram-website
npm run test:website-vercel
npm run test:workspace
```

Tes browser dapat memerlukan Playwright/Chromium. Beberapa tes pembayaran memakai mock; kelulusan tes simulasi bukan bukti transaksi QRIS live. Lihat tes dan catatan di `docs/` untuk batas cakupannya.

## Deploy dan pemeriksaan rilis

- **Vercel:** hubungkan repo/project yang benar; cek environment variables, domain, rewrites, dan serverless routes. Periksa deployment preview sebelum production.
- **Appwrite:** deploy Functions ke project yang benar menggunakan entrypoint/package/build, environment, permissions, event/schedule, dan versi runtime yang sesuai konfigurasi Appwrite. Mem-push repo ke GitHub/Vercel tidak dengan sendirinya menerbitkan Appwrite Functions.
- Pertahankan Feature Flags Telegram dalam keadaan nonaktif sampai rilis disetujui dan uji end-to-end nyata lulus.
- Sebelum rilis, cek checkout, verifikasi webhook/status QRIS, aktivasi hak akses, login member, izin admin, Telegram `/start`, delivery tester, serta penghapusan pesan. Siapkan rollback deployment Vercel dan Appwrite.

## Catatan konsistensi yang perlu ditinjau

Repo mempertahankan nama teknis/legacy `badai-prompt-umkm`, `badai_prompt_umkm`, serta beberapa domain BADAI PROMPT. Harga/checkout berbeda antara landing utama dan landing Instagram. Metadata kanonis juga perlu disejajarkan dengan Vercel domain dan `TELEGRAM_WEBHOOK_BASE`. Sebelum mengubah ini, pastikan project produksi, konfigurasi harga, domain, dan data transaksi yang aktif—jangan menyimpulkan hanya dari README atau nama repo.
