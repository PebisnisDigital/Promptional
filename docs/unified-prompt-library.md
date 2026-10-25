# PROMPTIONAL — Satu sumber prompt untuk Member Area dan Telegram

## Sumber resmi

- Database Appwrite: `badai_prompt_umkm`
- Tabel aktif: `scene_prompts`
- Status `is_published=true` menentukan prompt yang tampil di Member Area dan tersedia untuk dikirim bot.
- Urutan distribusi: `sort_order` menaik, kemudian `$id` agar deterministik.
- Prompt yang tidak memiliki gambar tetap dapat dibaca/salin di Member Area dan dikirim sebagai teks melalui Telegram; foto hanya dikirim jika URL gambar HTTPS tersedia.

Tabel lama `prompts` menyimpan 500 template teks UMKM dari sistem sebelumnya. Tabel tersebut **tetap disimpan sebagai arsip**, tidak dipakai untuk feed Member Area atau distribusi Telegram, dan tidak dimigrasi/dihapus tanpa kurasi serta keputusan pemilik.

## Jadwal Telegram

- Tab Admin → Telegram → Konten mengambil katalog langsung dari `scene_prompts` setiap kali halaman dimuat atau tombol SEGARKAN diklik. Tidak ada salinan teks prompt di kalender.
- Hingga 365 slot direncanakan otomatis dari prompt terbit. Dua slot awal/override lain tetap dipertahankan. Jika koleksi lebih kecil dari jumlah hari, antrean otomatis mengulang setelah koleksi habis; kartu ditandai `ULANGAN`.
- Admin boleh mengganti urutan, mengatur upselling/CTA khusus, atau melewati hari tertentu. Override hanya menyimpan referensi prompt dan pengaturan kirim.
- Edit teks/gambar atau publikasi di Admin Prompt langsung memengaruhi konten pengiriman berikutnya. Prompt draf/tidak layak tidak masuk antrean. Slot manual yang merujuk prompt tidak lagi tersedia ditandai untuk review, tidak dikirim.
- Tanpa kampanye Marketing aktif, fallback bot memakai katalog yang sama melalui cursor per member dan berputar ke awal ketika seluruh prompt telah dikirim.
- Pengiriman kepada member Free dan penghapusan pesan tetap melalui mekanisme yang sudah ada, mengikuti `free_days`, `premium_time`, dan `delete_hours` di pengaturan bot. Nilai produksi yang ditemukan saat audit: 1 hari, 06.00 WIB, dan 24 jam.
- Menyimpan/menyinkronkan konten **tidak mengaktifkan pengiriman**. Sakelar `TELEGRAM_MARKETING_ENABLED`, `TELEGRAM_SEND_ENABLED`, akun penguji, dan pengaturan pause/dry-run tetap berlaku.

## Verifikasi sebelum rilis

1. Jalankan tes Marketing, Telegram backend, dan smoke UI.
2. Pastikan 185 prompt terbit (per 25 Okt 2026) ditampilkan di Admin Telegram; 223 draf tidak tersisip.
3. Pastikan kalender menampilkan override BP001/BP002, lalu BP003 dan seterusnya otomatis dalam urutan `sort_order`.
4. Terbitkan satu prompt baru di lingkungan uji, segarkan Telegram, pastikan jumlah bertambah tanpa membuat record konten kedua. Batalkan perubahan uji setelah pengecekan.
5. Uji kirim satu konten ke tester yang terotorisasi; cek foto/teks/CTA dan penghapusan setelah batas waktu simulasi. Jangan kirim broadcast massal dalam validasi.

## Rollback

- Frontend Vercel: pulihkan deployment sebelumnya bila perlu.
- Appwrite `activate-member`: pilih deployment aktif sebelumnya. Tidak ada migrasi/skema/database yang perlu dibalik.
- Tidak ada data prompt yang diubah oleh perubahan source ini.
