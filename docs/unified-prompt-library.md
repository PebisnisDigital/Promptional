# PROMPTIONAL — Satu sumber prompt untuk Member Area dan Telegram

## Sumber resmi

- Database Appwrite: `badai_prompt_umkm`
- Tabel aktif: `scene_prompts`
- Status `is_published=true` menentukan prompt yang tampil di Member Area dan tersedia untuk dikirim bot.
- Urutan perpustakaan: `sort_order` menaik, kemudian `$id`. Urutan kirim sepenuhnya ditentukan slot manual admin.
- Prompt yang tidak memiliki gambar tetap dapat dibaca/salin di Member Area dan dikirim sebagai teks melalui Telegram; foto hanya dikirim jika URL gambar HTTPS tersedia.

Tabel lama `prompts` menyimpan 500 template teks UMKM dari sistem sebelumnya. Tabel tersebut **tetap disimpan sebagai arsip**, tidak dipakai untuk feed Member Area atau distribusi Telegram, dan tidak dimigrasi/dihapus tanpa kurasi serta keputusan pemilik.

## Jadwal Telegram

- Tab Admin → Telegram → Konten mengambil katalog langsung dari `scene_prompts` setiap kali halaman dimuat atau tombol SEGARKAN diklik. Tidak ada salinan teks prompt di kalender.
- Semua prompt yang terbit masuk **Perpustakaan Telegram** tanpa dijadwalkan. Panel perpustakaan **hanya menampilkan prompt belum dijadwalkan**; total terbit tetap tersedia sebagai angka ringkasan. Kartu yang sudah masuk kalender tidak diduplikasi di panel kanan, tetapi tetap berasal dari satu record `scene_prompts` yang sama. Kalender 365 hari hanya menampilkan slot yang sengaja disimpan admin; hari kosong tidak mengirim.
- Penjadwalan desktop: seret kartu perpustakaan ke hari tujuan agar slot langsung disimpan menggunakan CTA default; setelah server mengonfirmasi, kartu menghilang dari perpustakaan dan muncul di kalender dengan animasi singkat. Pada HP, pilih prompt, ketuk hari, dan simpan untuk hasil yang sama. Prompt tidak boleh dijadwalkan pada lebih dari satu hari sekaligus (divalidasi backend).
- Admin dapat menyeret kartu kalender kembali ke panel perpustakaan atau menekan **KOSONGKAN HARI** untuk mengembalikannya; tindakan ini memerlukan konfirmasi dan menghapus **hanya penjadwalannya**, bukan data prompt aslinya. Pemindahan antarhari dan tukar dua slot tidak memengaruhi jumlah prompt di perpustakaan. Admin tetap dapat mengatur upselling khusus untuk setiap hari.
- Dua slot BP001/BP002 yang sudah dibuat admin tetap dipertahankan. Tidak ada penghapusan atau pengisian otomatis pada hari lain.
- Edit teks/gambar atau publikasi di Admin Prompt langsung memengaruhi isi perpustakaan dan konten slot terkait. Prompt draf tidak dikirim; slot yang merujuk prompt tidak lagi tersedia ditandai untuk review.
- Bot **tidak mempunyai fallback rotasi otomatis**. Bila kampanye Marketing belum aktif atau hari tersebut kosong, bot melewati kiriman. `/start` dan `/prompt` memberi balasan informatif bila hari itu tidak tersedia.
- Pengiriman kepada member Free dan penghapusan pesan tetap melalui mekanisme yang sudah ada, mengikuti `free_days`, `premium_time`, dan `delete_hours` di pengaturan bot. Nilai produksi yang ditemukan saat audit: 1 hari, 06.00 WIB, dan 24 jam.
- Menyimpan/menyinkronkan konten **tidak mengaktifkan pengiriman**. Sakelar `TELEGRAM_MARKETING_ENABLED`, `TELEGRAM_SEND_ENABLED`, akun penguji, dan pengaturan pause/dry-run tetap berlaku.

## Verifikasi sebelum rilis

1. Jalankan tes Marketing, Telegram backend, dan smoke UI.
2. Pastikan 185 prompt terbit (per 25 Okt 2026) ditampilkan di Admin Telegram; 223 draf tidak tersisip.
3. Pastikan kalender hanya menampilkan dua override lama BP001/BP002 dan hari 3–365 tetap kosong.
4. Terbitkan satu prompt baru di lingkungan uji, segarkan Telegram, pastikan jumlah bertambah tanpa membuat record konten kedua. Batalkan perubahan uji setelah pengecekan.
5. Jadwalkan prompt pada satu hari kosong di lingkungan uji, pastikan tersimpan dari drag & drop, dan kosongkan lagi. Uji kirim konten ke tester yang terotorisasi; cek foto/teks/CTA dan penghapusan setelah batas waktu simulasi. Jangan kirim broadcast massal.

## Rollback

- Frontend Vercel: pulihkan deployment sebelumnya bila perlu.
- Appwrite `activate-member`: pilih deployment aktif sebelumnya. Tidak ada migrasi/skema/database yang perlu dibalik.
- Tidak ada data prompt yang diubah oleh perubahan source ini.
