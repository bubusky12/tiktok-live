const { ipcRenderer } = require('electron');

// Event listener untuk memilih file
document.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = require('electron');
  
    // Event listener untuk memilih file
    document.getElementById('upload-json').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file && file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const contents = e.target.result;
          try {
            const commands = JSON.parse(contents);
            document.getElementById('file-info').innerText = `File yang diunggah: ${file.name}`;
            window.commandsData = commands;
          } catch (error) {
            alert('Terjadi kesalahan dalam membaca file JSON.');
          }
        };
        reader.readAsText(file);
      } else {
        alert('Silakan pilih file JSON yang valid.');
      }
    });
  
    // Event listener untuk tombol simpan konfigurasi
    document.getElementById('save-config').addEventListener('click', async () => {
      const tiktokUsername = document.getElementById('tiktok-username').value;
      const commands = window.commandsData;
  
      if (!commands) {
        alert('Silakan unggah file JSON terlebih dahulu.');
        return;
      }
  
      if (!tiktokUsername) {
        alert('Nama pengguna TikTok tidak boleh kosong.');
        return;
      }
  
      const config = {
        tiktokUsername,
        commands,
      };
  
      try {
        const result = await ipcRenderer.invoke('save-config', config);
        if (result.success) {
          alert('Konfigurasi berhasil disimpan!');
        } else {
          alert(`Gagal menyimpan konfigurasi: ${result.error}`);
        }
      } catch (error) {
        alert('Terjadi kesalahan saat menyimpan konfigurasi.');
      }
    });
  });