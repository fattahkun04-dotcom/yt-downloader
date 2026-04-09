Instruksi awal untuk AI:
"Kamu adalah full-stack developer. Buatkan aplikasi web sederhana untuk mengunduh audio YouTube dalam format MP3. Gunakan Node.js + Express untuk backend, HTML/CSS/JavaScript vanilla untuk frontend. Backend wajib menggunakan library ytdl-core dan ffmpeg. Pastikan tidak menyimpan file di server (streaming langsung). Berikan kode lengkap beserta instruksi setup."

1. Inisialisasi Proyek & Instalasi Dependensi
Prompt ke AI:
"Buatkan struktur folder proyek, file package.json, dan perintah instalasi dependensi yang diperlukan."

Ekspektasi Output AI:

Struktur folder:

text
youtube-audio-downloader/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server.js
├── package.json
└── .gitignore
Daftar dependensi di package.json:

express

ytdl-core

fluent-ffmpeg

cors

Perintah instalasi: npm install express ytdl-core fluent-ffmpeg cors

Catatan tambahan: Sistem harus memiliki FFmpeg terinstal secara global. Jika belum, beri tahu pengguna cara menginstalnya (misal: sudo apt install ffmpeg di Linux, brew install ffmpeg di macOS, atau unduh binary untuk Windows).

2. Membangun Backend (server.js)
Prompt ke AI:
"Tulis kode untuk server.js menggunakan Express. Sediakan dua endpoint:

GET /api/info — menerima parameter url, mengembalikan judul dan durasi video menggunakan ytdl-core.

GET /api/download — menerima parameter url, langsung mengalirkan (stream) hasil konversi audio ke MP3 sebagai attachment, menggunakan ytdl-core yang di-pipe ke ffmpeg. Jangan simpan file di server. Sertakan error handling yang baik."

Ekspektasi Output AI:

Kode server Express yang berjalan di port 3000 (atau dari environment variable PORT).

Middleware cors untuk mengizinkan akses dari frontend.

Endpoint /api/info yang memvalidasi URL dan mengembalikan JSON:

json
{ "title": "Judul Video", "duration": "3:45" }
Endpoint /api/download yang:

Mengatur header Content-Disposition dengan nama file yang aman (mengganti karakter ilegal).

Membuat stream audio dari ytdl-core dengan kualitas filter: 'audioonly'.

Menggunakan fluent-ffmpeg untuk mengonversi stream ke format MP3.

Menangani error seperti URL invalid, video tidak tersedia, atau kegagalan FFmpeg.

3. Membangun Frontend (HTML, CSS, JavaScript)
Prompt ke AI:
"Buatkan antarmuka pengguna yang sederhana dan responsif di folder public/.

index.html: Form input URL, tombol 'Cek Info', area untuk menampilkan detail video, dan tombol 'Download MP3' (awalnya disembunyikan).

style.css: Desain modern, minimalis, dengan skema warna gelap/terang yang bersih. Gunakan flexbox/grid.

script.js:

Fungsi fetchVideoInfo(): Panggil endpoint /api/info, tampilkan spinner, lalu tampilkan judul/durasi dan tombol download jika berhasil.

Fungsi downloadAudio(): Arahkan browser ke /api/download dengan URL video, atau tangani proses download.

Validasi URL sederhana di sisi klien.

Tampilkan pesan error yang ramah."

Ekspektasi Output AI:

HTML dengan struktur semantik, input field, tombol, dan area hasil yang dinamis.

CSS yang membuat aplikasi terlihat profesional (bisa menggunakan variabel CSS, border-radius, transisi halus).

JavaScript yang menggunakan async/await, try/catch, dan memanipulasi DOM untuk menampilkan status (loading, error, sukses).

Penanganan kasus ketika video berdurasi lebih dari 1 jam (konversi detik ke format HH:MM:SS).

4. Testing dan Troubleshooting
Prompt ke AI:
"Berikan daftar periksa (checklist) untuk menguji aplikasi ini, serta solusi untuk masalah umum seperti error FFmpeg tidak ditemukan, URL tidak valid, atau video yang dibatasi umur."

Ekspektasi Output AI:

Checklist pengujian:

Jalankan server dengan node server.js.
Buka http://localhost:3000.
Masukkan URL YouTube valid (misal: video musik bebas hak cipta).
Klik "Cek Info", pastikan judul dan durasi muncul.
Klik "Download MP3", pastikan file terunduh dengan nama yang benar.
Uji dengan URL tidak valid, pastikan pesan error muncul.
Uji dengan video yang di-private/unavailable, pastikan error tertangani.
Troubleshooting umum:

Error: "FFmpeg not found": Beri tahu pengguna cara instal FFmpeg global atau arahkan path binary di kode.

Error: "Video unavailable": Bisa karena pembatasan geografis atau video privat. Sertakan penanganan status code 403/410.

Error: "Sign in to confirm your age": Beberapa video memerlukan cookie autentikasi. Beri tahu bahwa fitur ini tidak didukung di versi dasar.

5. Deployment (Opsional)
Prompt ke AI:
"Berikan panduan singkat untuk men-deploy aplikasi ini ke platform seperti Railway, Render, atau Cyclic. Perhatikan bahwa FFmpeg harus tersedia di environment production."

Ekspektasi Output AI:

Instruksi untuk menambahkan buildpack atau package tambahan (misal: ffmpeg-static) agar FFmpeg tersedia di environment cloud.

Contoh file Dockerfile atau render.yaml jika diperlukan.
