# CS Discord Bot (Gemini)

Panel "AI Roleplay Character Creator": pilih latar belakang, vibe, bahasa, jumlah paragraf, klik **Buat Karakter**, isi form (nama, umur, jenis kelamin, kepribadian, detail tambahan), lalu character story langsung dibuat.

## 1. Siapkan bot Discord
1. https://discord.com/developers/applications lalu **New Application**.
2. Menu **Bot** lalu **Reset Token**, salin sebagai `DISCORD_TOKEN`.
3. **General Information**, salin **Application ID** sebagai `CLIENT_ID`.
4. **OAuth2 > URL Generator**: scope `bot` + `applications.commands`, permission `Send Messages`, `Embed Links`, `Attach Files`. Invite bot ke server.

## 2. API key Gemini
Ambil di https://aistudio.google.com/apikey lalu simpan sebagai `GEMINI_API_KEY`.

## 3. Deploy ke Railway
1. Upload folder ini ke GitHub.
2. Railway: **New Project > Deploy from GitHub repo**.
3. Tab **Variables**: isi `DISCORD_TOKEN`, `CLIENT_ID`, `GEMINI_API_KEY` (opsional `GUILD_ID`, `GEMINI_MODEL`).
4. Railway menjalankan `npm start` otomatis. Tidak perlu port/domain.

## 4. Pakai
- Admin (permission Manage Server) ketik `/panel` di channel yang diinginkan.
- Member memilih 4 menu, klik **Buat Karakter**, isi form, submit.
- Tombol **Generate Ulang** membuat versi baru dari data yang sama.

## Catatan anti deteksi AI
Tidak ada jaminan 100% lolos GPTZero dkk. Bot membuat draft lalu menulis ulang dengan ritme kalimat bervariasi dan membuang pola khas AI. Tetap cek di detektor dan edit sedikit dengan kata-katamu sendiri.
