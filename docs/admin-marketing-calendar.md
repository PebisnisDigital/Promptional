# PROMPTIONAL · Telegram → Konten: Satu Kalender 365 Hari

## Pengaturan tunggal

- Semua prompt **published** berasal dari `scene_prompts`, database Member Area. Penerbitan menambah prompt ke perpustakaan Telegram, **bukan** jadwal kirim otomatis.
- Admin memindahkan prompt dari perpustakaan ke satu slot kalender Hari 1–365, atau mengembalikannya. Slot hanya menyimpan referensi `prompt_id`; prompt beserta gambar diambil dari sumber yang sama saat terkirim.
- Pengaturan jadwal tunggal: **DRAF/AKTIF**, tanggal mulai WIB, jam kirim WIB, durasi hapus pesan (1–36 jam, default 24), pilihan ulang setelah Hari 365, dan template upselling/tombol CTA. Tiap hari boleh punya upselling berbeda.
- **DRAF**: kiriman rutin ditahan. **AKTIF**: hanya hari yang berisi prompt terbit yang boleh dikirim kepada Member Free sesuai hari dan jam kampanye. Member Premium membuka perpustakaan penuh langsung lewat website.
- Hari kosong dilewati, tidak ada rotasi otomatis maupun fallback ke prompt lain. Setelah Hari 365 kampanye berhenti kecuali loop diaktifkan.
- Penghapusan pesan jatuh tempo tetap diproses walaupun kampanye DRAF, dengan jadwal `delete_at` yang dicatat untuk masing-masing kiriman. Pengiriman tes ke akun penguji juga dihapus.

## Pengaman server

- `telegram-marketing-settings` menyimpan pengaturan jadwal. `telegram-marketing-NNN` (di `telegram_state`, kind `marketing_slot`) menyimpan slot Hari N. Migrasi tidak merombak ataupun menghapus slot yang telah diatur.
- `TELEGRAM_SEND_ENABLED` masih merupakan **emergency lock** server dan bot utama harus aktif. Tidak ada lagi sakelar terpisah `TELEGRAM_MARKETING_ENABLED`.
- Pengaturan otomatisasi lama di `telegram-settings` (`enabled`, `paused`, `dry_run`, `premium_time`, `free_days`, `delete_hours`) hanya arsip; UI-nya dihapus dan aksi admin `settings` ditolak. `main_bot_id` dan batas internal `batch_size` tetap digunakan untuk infrastruktur bot.
- Broadcast manual dan Testing Center memerlukan tindakan serta konfirmasi admin tersendiri. Tidak terkait status kalender dan tidak dipicu oleh penyimpanan jadwal.
- Cron Appwrite melakukan housekeeping penghapusan terlebih dahulu, sebelum memeriksa apakah kalender AKTIF. Waktu pengiriman tergantung frekuensi cron; jam 06.00 adalah batas waktu mulai, bukan jaminan sampai tepat detik 06.00.

## Operasional

1. Pastikan bot aktif di **Telegram → BOT**.
2. Buka **Telegram → KONTEN**, tarik/pilih prompt ke Hari 1–365.
3. Isi tanggal mulai, jam WIB, durasi penghapusan, dan CTA. Biarkan **DRAF** saat menyiapkan semua konten.
4. Gunakan **Uji Kirim Konten** hanya pada tester yang telah diotorisasi.
5. Setelah siap, pilih **AKTIF**, konfirmasi, lalu **SIMPAN PENGATURAN**. Tidak ada kiriman massal yang dipicu hanya oleh klik Simpan; cron mengirim konten yang jatuh tempo.
