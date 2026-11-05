/* PROMPTIONAL: local AI translation of authorized imported prompts.
   Uses Chrome desktop Translator API only. NO cloud AI calls, API credits, or paid services.
   Never modifies non-sgxs_ rows; saves only after quality/structure validation.
*/
(function () {
  'use strict';
  const section = document.querySelector('#v-prompts');
  const anchor = section && section.querySelector('.import-disclosure');
  if (!anchor || !window.Appwrite || typeof tables === 'undefined') return;

  const box = document.createElement('details');
  box.className = 'import-disclosure';
  box.id = 'localTranslationTool';
  box.innerHTML =
    '<summary>Terjemahkan koleksi global (GRATIS, tanpa kredit AI)</summary>' +
    '<div class="importbox" style="display:grid;gap:12px">' +
      '<p style="margin:0">Menggunakan penerjemah bawaan <b>Chrome desktop</b> di perangkat ini. Tidak menggunakan API, biaya, atau kredit AI. Hanya prompt impor GitHub yang diubah; kode BP, gambar, dan kategori tetap.</p>' +
      '<p style="margin:0;font-size:13px;color:#62626a">Gunakan tombol uji dahulu. Saat menyimpan massal, biarkan tab Admin tetap terbuka. Bisa dijeda dan dilanjutkan kapan saja. Teks sumber tetap terlacak lewat tautan GitHub yang disimpan.</p>' +
      '<div class="importactions" style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn dark sm" id="localTranslationPreview">UJI 3 CONTOH</button>' +
        '<button type="button" class="btn pink sm" id="localTranslationStart" disabled>TERJEMAHKAN & SIMPAN</button>' +
        '<button type="button" class="btn dark sm" id="localTranslationPause" disabled>JEDA</button>' +
      '</div>' +
      '<div class="msg" id="localTranslationStatus" role="status" aria-live="polite">Belum dimulai.</div>' +
      '<progress id="localTranslationProgress" max="100" value="0" style="width:100%;accent-color:#ff6b35"></progress>' +
      '<div id="localTranslationExamples" style="font-size:13px;white-space:pre-wrap;max-height:480px;overflow:auto"></div>' +
    '</div>';
  anchor.insertAdjacentElement('afterend', box);

  const byId = id => document.getElementById(id);
  const status = byId('localTranslationStatus');
  const examples = byId('localTranslationExamples');
  const progress = byId('localTranslationProgress');
  const previewButton = byId('localTranslationPreview');
  const startButton = byId('localTranslationStart');
  const pauseButton = byId('localTranslationPause');
  const hasHan = value => /[\u3400-\u9fff]/.test(String(value || ''));
  const isSource = row => /^sgxs_\d{4}$/.test(String(row.$id || ''));
  let translator = null;
  let jobActive = false;
  let pauseRequested = false;
  let previewComplete = false;

  function note(value, bad = false) {
    status.textContent = value;
    status.style.color = bad ? '#b91c1c' : '';
  }
  function lineParts(value) {
    return String(value).split(/(\r?\n)/);
  }
  function invariantTokens(value) {
    const text = String(value);
    return {
      structure: (text.match(/["{}\[\]<>\\]/g) || []).sort().join(''),
      variables: (text.match(/(\{\{[^{}]+\}\}|\[[A-Za-z_][^\]\n]{0,80}\]|https?:\/\/[^\s"'<>]+)/g) || []).sort().join('|')
    };
  }
  function safeEnough(original, translated) {
    if (!String(translated || '').trim()) return false;
    const before = invariantTokens(original), after = invariantTokens(translated);
    return before.structure === after.structure && before.variables === after.variables;
  }
  async function translateHanOnly(part) {
    const pattern = /[\u3400-\u9fff][\u3400-\u9fff\u3000-\u303f\uff00-\uffef \t]*/g;
    let found, cursor = 0, result = '';
    while ((found = pattern.exec(part)) !== null) {
      result += part.slice(cursor, found.index);
      const fragment = found[0];
      const done = await translator.translate(fragment);
      if (!done || hasHan(done)) throw new Error('Terjemahan belum lengkap.');
      result += done;
      cursor = found.index + fragment.length;
    }
    return result + part.slice(cursor);
  }
  async function translateLine(part) {
    if (!hasHan(part)) return part;
    const match = part.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const prefix = match ? match[1] : '';
    const core = match ? match[2] : part;
    const suffix = match ? match[3] : '';
    if (!core) return part;
    try {
      const translated = await translator.translate(core);
      if (!hasHan(translated) && safeEnough(core, translated)) return prefix + translated + suffix;
    } catch (_) {}
    return prefix + await translateHanOnly(core) + suffix;
  }
  async function translatePrompt(text) {
    if (!hasHan(text)) return text;
    const trimmed = String(text).trim();
    // Preserve JSON property names, array structure, and object syntax.
    try {
      const parsed = JSON.parse(trimmed);
      async function translateValues(value) {
        if (typeof value === 'string') {
          if (!hasHan(value)) return value;
          return await translatePrompt(value);
        }
        if (Array.isArray(value)) {
          const list = [];
          for (const item of value) list.push(await translateValues(item));
          return list;
        }
        if (value && typeof value === 'object') {
          const object = {};
          for (const key of Object.keys(value)) object[key] = await translateValues(value[key]);
          return object;
        }
        return value;
      }
      const done = JSON.stringify(await translateValues(parsed), null, 2);
      if (hasHan(done)) throw new Error('Masih mengandung aksara Mandarin.');
      return done;
    } catch (error) {
      // If this was a valid JSON document, a translation failure must not
      // silently break its structure.
      try { JSON.parse(trimmed); throw error; } catch (parseError) {
        if (parseError === error) throw error;
      }
    }
    const list = lineParts(text);
    const result = [];
    for (const part of list) result.push(await translateLine(part));
    const done = result.join('');
    if (hasHan(done)) throw new Error('Masih ada aksara Mandarin.');
    if (!safeEnough(text, done)) throw new Error('Struktur atau placeholder tidak cocok.');
    return done;
  }
  async function translateRow(row) {
    const newTitle = hasHan(row.title) ? await translator.translate(row.title) : row.title;
    if (!newTitle || hasHan(newTitle) || newTitle.length > 255) throw new Error('Judul belum berhasil diterjemahkan.');
    const newPrompt = hasHan(row.prompt_text) ? await translatePrompt(row.prompt_text) : row.prompt_text;
    if (!newPrompt || hasHan(newPrompt)) throw new Error('Isi prompt belum selesai diterjemahkan.');
    const updates = {};
    if (newTitle !== row.title) updates.title = newTitle;
    if (newPrompt !== row.prompt_text) updates.prompt_text = newPrompt;
    return updates;
  }
  async function getRows() {
    const output = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const response = await tables.listRows({
        databaseId: DB, tableId: TABLE,
        queries: [Query.orderAsc('sort_order'), Query.limit(100), Query.offset(offset)]
      });
      const batch = (response.rows || response.documents || []).map(rowData);
      output.push(...batch.filter(isSource));
      if (batch.length < 100) break;
    }
    return output;
  }
  function busy(value) {
    previewButton.disabled = value;
    startButton.disabled = value || !previewComplete;
    pauseButton.disabled = !value;
  }
  function ensureTranslator() {
    if (translator) return Promise.resolve(translator);
    if (!('Translator' in self)) {
      throw new Error('Chrome ini belum menyediakan Translator API. Gunakan Chrome desktop terbaru.');
    }
    // Called directly inside the click event: Chrome requires user activation.
    return Translator.create({
      sourceLanguage: 'zh',
      targetLanguage: 'id',
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', event => {
          const number = Math.round((event.loaded || 0) * 100);
          note('Mengunduh model bahasa gratis di Chrome: ' + number + '%');
        });
      }
    }).then(instance => (translator = instance));
  }
  pauseButton.onclick = () => {
    pauseRequested = true;
    note('Menjeda setelah prompt yang sedang dikerjakan selesai…');
  };
  previewButton.onclick = async () => {
    if (jobActive) return;
    jobActive = true;
    pauseRequested = false;
    busy(true);
    try {
      const promise = ensureTranslator();
      await promise;
      note('Menyiapkan tiga contoh terjemahan…');
      const rows = (await getRows()).filter(row => hasHan(row.title) || hasHan(row.prompt_text)).slice(0, 3);
      examples.textContent = '';
      let previewSuccess = 0;
      for (const row of rows) {
        try {
          const updated = await translateRow(row);
          const before = row.title + '\n' + (row.prompt_text || '').slice(0, 260);
          const after = (updated.title || row.title) + '\n' + (updated.prompt_text || row.prompt_text || '').slice(0, 260);
          examples.textContent += '— ' + String(row.sort_order) + ' —\nASLI:\n' + before + '\n\nINDONESIA:\n' + after + '\n\n';
          previewSuccess++;
        } catch (error) {
          examples.textContent += 'Contoh ' + row.$id + ' perlu ditinjau: ' + (error.message || String(error)) + '\n\n';
        }
      }
      previewComplete = previewSuccess > 0;
      note(previewComplete ? 'Uji berhasil. Periksa hasil di bawah, lalu klik TERJEMAHKAN & SIMPAN jika sudah sesuai.' : 'Tidak ada data Mandarin yang perlu diterjemahkan.');
    } catch (error) {
      note('Gagal uji: ' + (error.message || String(error)) + '. Tidak ada perubahan data.', true);
    } finally { jobActive = false; busy(false); }
  };
  startButton.onclick = async () => {
    if (jobActive || !previewComplete) return;
    const confirmed = window.confirm('Terjemahkan dan simpan koleksi impor secara bertahap? Gratis, tanpa kredit AI. Prompt lama tidak disentuh. Tindakan dapat dijeda.');
    if (!confirmed) return;
    jobActive = true;
    pauseRequested = false;
    busy(true);
    let completed = 0, skipped = 0, total = 0;
    try {
      const promise = ensureTranslator();
      await promise;
      note('Membaca koleksi global dari database…');
      const rows = (await getRows()).filter(row => hasHan(row.title) || hasHan(row.prompt_text));
      total = rows.length;
      progress.max = total || 1;
      progress.value = 0;
      for (const row of rows) {
        if (pauseRequested) break;
        try {
          const updates = await translateRow(row);
          if (Object.keys(updates).length) {
            await tables.updateRow({databaseId: DB, tableId: TABLE, rowId: row.$id, data: updates});
          }
          completed++;
        } catch (error) {
          skipped++;
          if (skipped <= 12) examples.textContent += 'LEWATI ' + row.$id + ': ' + (error.message || String(error)) + '\n';
        }
        progress.value = completed + skipped;
        note('Diproses ' + (completed + skipped) + '/' + total + ' · Tersimpan ' + completed + ' · Perlu tinjau ' + skipped);
      }
      if (pauseRequested) {
        note('Dijeda. Tersimpan: ' + completed + '. Klik TERJEMAHKAN & SIMPAN lagi untuk melanjutkan sisa data.');
      } else {
        note('Selesai! Tersimpan: ' + completed + '. Perlu tinjau manual: ' + skipped + '.');
      }
      await loadPromptMeta();
      await loadPrompts();
      renderPrompts();
    } catch (error) {
      note('Proses terhenti: ' + (error.message || String(error)) + '. Data yang sudah tersimpan tetap aman; bisa dilanjutkan.', true);
    } finally { jobActive = false; busy(false); }
  };
})();
