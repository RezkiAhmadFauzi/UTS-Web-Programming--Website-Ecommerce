'use strict';
const $ = s => document.querySelector(s);
const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));
const get = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch (e) {
    return d;
  }
};
const set = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    console.error('Gagal menyimpan data ke penyimpanan browser.', e);
    return false;
  }
};
const tgl = t => new Date(t).toLocaleDateString('en-CA');
const photoSrc = p => typeof p.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image) ? p.image : '';

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Pilih file gambar yang valid.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Ukuran foto maksimal 5 MB.'));

    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (image.naturalWidth * image.naturalHeight > 40000000) return reject(new Error('Resolusi foto terlalu besar.'));

      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Browser tidak bisa memproses foto ini.'));

      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', .78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Foto tidak bisa dibuka.'));
    };
    image.src = url;
  });
}

/* Data awal: h = harga jual, m = harga modal, s = stok */
const SEED=[
  {id: 1, n: 'Beras 1 kg', c: 'Sembako', h: 18000, m: 62000, s: 40, e: '🍚'},
  {id: 2, n: 'Minyak Goreng 1 L', c: 'Sembako', h: 18000, m: 16000, s: 60, e: '🛢️'},
  {id: 3, n: 'Gula Pasir 1 kg', c: 'Sembako', h: 17000, m: 15000, s: 50, e: '🍬'},
  {id: 4, n: 'Telur Ayam 1 kg', c: 'Sembako', h: 29000, m: 26500, s: 30, e: '🥚'},
  {id: 5, n: 'Kopi Sachet (10 pcs)', c: 'Minuman', h: 14000, m: 11500, s: 80, e: '☕'},
  {id: 6, n: 'Teh Botol 450 ml', c: 'Minuman', h: 5000, m: 3800, s: 100, e: '🧃'},
  {id: 7, n: 'Mie Instan Goreng', c: 'Makanan', h: 3500, m: 2800, s: 200, e: '🍜'},
  {id: 8, n: 'Sabun Cuci Piring', c: 'Kebutuhan Rumah', h: 9000, m: 7000, s: 45, e: '🧼'}
];
function seedSales() {
  const out = [], now = Date.now();
  for (let i = 0; i < 18; i++) {
    const a = SEED[(i * 3) % SEED.length], b = SEED[(i * 5 + 1) % SEED.length];
    const items = [[a, i % 4 + 1], [b, 1]].map(([x, q]) => ({id: x.id, n: x.n, q: q, h: x.h, m: x.m}));
    out.push({
      no: 'TRX-SEED-' + i,
      t: new Date(now - (i % 6 + 1) * 864e5 - i * 36e5).toISOString(),
      items: items,
      total: items.reduce((s, x) => s + x.h * x.q, 0),
      laba: items.reduce((s, x) => s + (x.h - x.m) * x.q, 0),
      metode: i % 2 ? 'qris' : 'tunai',
      bayar: 0
    });
  }
  return out;
}
let products = get('rezki_products', null), sales = get('rezki_sales', null);
if (!products) {
  products = SEED.map(p => ({...p}));
  set('rezki_products', products);
}
if (!sales) {
  sales = seedSales();
  set('rezki_sales', sales);
}

function toast(m) {
  const t = $('#rezki_toast');
  t.textContent = m;
  t.classList.add('rezki_show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('rezki_show'), 2200);
}
function drawQR(total) {
  const c = $('#rezki_qr'), x = c.getContext('2d'), n = 25, s = c.width / n;
  let seed = total + 7;
  const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#111';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const f = (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8);
      if (!f && r() > .5) x.fillRect(i * s, j * s, s, s);
    }
  }
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([a, b]) => {
    x.fillStyle = '#111';
    x.fillRect(a * s, b * s, 7 * s, 7 * s);
    x.fillStyle = '#fff';
    x.fillRect((a + 1) * s, (b + 1) * s, 5 * s, 5 * s);
    x.fillStyle = '#111';
    x.fillRect((a + 2) * s, (b + 2) * s, 3 * s, 3 * s);
  });
}

function initShop() {
  let cart = get('rezki_cart', {});
  function categories() {
    const selected = $('#rezki_kategori').value;
    const cats = ['Semua', ...new Set(products.map(p => p.c))];
    $('#rezki_kategori').innerHTML = cats.map(c => `<option>${esc(c)}</option>`).join('');
    if (cats.includes(selected)) $('#rezki_kategori').value = selected;
  }
  const lines = () => Object.entries(cart)
    .map(([id, q]) => ({p: products.find(x => x.id == id), q: q}))
    .filter(l => l.p);
  const total = () => lines().reduce((a, l) => a + l.p.h * l.q, 0);
  const open = v => document.body.classList.toggle('rezki_cart_on', v);

  function grid() {
    const q = $('#rezki_cari').value.toLowerCase(), k = $('#rezki_kategori').value;
    const list = products.filter(p => (k === 'Semua' || p.c === k) && p.n.toLowerCase().includes(q));
    $('#rezki_grid').innerHTML = list.length ? list.map(p => {
      const image = photoSrc(p);
      const photo = image
        ? `<img src="${image}" alt="Foto ${esc(p.n)}" loading="lazy">`
        : '<div class="rezki_photo_empty">Foto belum tersedia</div>';
      return `<article class="rezki_card"><div class="rezki_product_photo">${photo}</div><small>${esc(p.c)}</small><h3>${esc(p.n)}</h3><div class="rezki_price">${rp(p.h)}</div><div class="rezki_stok">${p.s > 0 ? 'Stok: ' + p.s : 'Stok habis'}</div><button class="rezki_btn" data-add="${p.id}" ${p.s < 1 ? 'disabled' : ''}>+ Keranjang</button></article>`;
    }).join('') : '<p>Produk tidak ditemukan.</p>';
  }

  function kembali() {
    const k = Number($('#rezki_uang').value || 0) - total();
    $('#rezki_kembali').textContent = rp(Math.max(k, 0));
  }

  function drawCart() {
    set('rezki_cart', cart);
    const L = lines();
    $('#rezki_cartcount').textContent = L.reduce((a, l) => a + l.q, 0);
    $('#rezki_cartlist').innerHTML = L.length
      ? L.map(l => `<div class="rezki_item"><div><b>${esc(l.p.n)}</b><small>${rp(l.p.h)}</small></div><div class="rezki_qty"><button data-act="min" data-id="${l.p.id}" aria-label="Kurangi">−</button><span>${l.q}</span><button data-act="plus" data-id="${l.p.id}" aria-label="Tambah">+</button></div></div>`).join('')
      : '<p class="rezki_empty">Keranjang masih kosong. Pilih produk dulu.</p>';
    $('#rezki_total').textContent = rp(total());
    kembali();
    if ($('#rezki_metode').value === 'qris') drawQR(total());
  }

  function struk(s) {
    $('#rezki_struk').innerHTML = `<h3>🛒 Berkah Mart</h3><small>${new Date(s.t).toLocaleString('id-ID')}<br>${s.no}</small><hr>`
      + s.items.map(i => `<div class="rezki_row"><span>${esc(i.n)} x${i.q}</span><span>${rp(i.h * i.q)}</span></div>`).join('')
      + `<hr><div class="rezki_row"><b>Total</b><b>${rp(s.total)}</b></div><div class="rezki_row"><span>Bayar (${s.metode.toUpperCase()})</span><span>${rp(s.bayar)}</span></div><div class="rezki_row"><span>Kembali</span><span>${rp(s.bayar - s.total)}</span></div><p class="rezki_center">Terima kasih sudah berbelanja!</p>`;
    $('#rezki_modal').hidden = false;
  }

  $('#rezki_cari').oninput = grid;
  $('#rezki_kategori').onchange = grid;
  $('#rezki_grid').onclick = e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const id = +b.dataset.add, p = products.find(x => x.id === id);
    if ((cart[id] || 0) >= p.s) return toast('Stok tidak cukup');
    cart[id] = (cart[id] || 0) + 1;
    drawCart();
    toast(p.n + ' masuk keranjang');
  };
  $('#rezki_cartlist').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = +b.dataset.id, p = products.find(x => x.id === id);
    if (b.dataset.act === 'plus') {
      if ((cart[id] || 0) >= p.s) return toast('Stok tidak cukup');
      cart[id]++;
    } else {
      cart[id]--;
      if (cart[id] <= 0) delete cart[id];
    }
    drawCart();
  };
  $('#rezki_cartbtn').onclick = () => open(true);
  $('#rezki_close').onclick = $('#rezki_overlay').onclick = () => open(false);
  $('#rezki_metode').onchange = () => {
    const q = $('#rezki_metode').value === 'qris';
    $('#rezki_tunai').hidden = q;
    $('#rezki_qrbox').hidden = !q;
    if (q) drawQR(total());
  };
  $('#rezki_uang').oninput = kembali;
  $('#rezki_checkout').onclick = () => {
    const L = lines();
    if (!L.length) return toast('Keranjang masih kosong');
    const t = total(), m = $('#rezki_metode').value, u = Number($('#rezki_uang').value || 0);
    if (L.some(l => l.q > l.p.s)) return toast('Ada produk yang stoknya tidak cukup');
    if (m === 'tunai' && u < t) return toast('Uang diterima kurang dari total');
    const sale = {
      no: 'TRX-' + Date.now(),
      t: new Date().toISOString(),
      items: L.map(l => ({id: l.p.id, n: l.p.n, q: l.q, h: l.p.h, m: l.p.m})),
      total: t,
      laba: L.reduce((a, l) => a + (l.p.h - l.p.m) * l.q, 0),
      metode: m,
      bayar: m === 'tunai' ? u : t
    };
    L.forEach(l => {
      l.p.s -= l.q;
    });
    sales.push(sale);
    set('rezki_products', products);
    set('rezki_sales', sales);
    cart = {};
    $('#rezki_uang').value = '';
    drawCart();
    grid();
    open(false);
    struk(sale);
  };
  $('#rezki_tutup').onclick = () => {
    $('#rezki_modal').hidden = true;
  };
  $('#rezki_cetak').onclick = () => {
    document.body.classList.add('rezki_ps');
    window.print();
    document.body.classList.remove('rezki_ps');
  };
  $('#rezki_burger').onclick = () => $('#rezki_menu').classList.toggle('rezki_open');
  $('#rezki_menu').onclick = e => {
    if (e.target.closest('a')) $('#rezki_menu').classList.remove('rezki_open');
  };
  $('#rezki_form').onsubmit = e => {
    e.preventDefault();
    const f = e.target, m = get('rezki_msgs', []);
    m.push({
      t: new Date().toISOString(),
      nama: f.nama.value.trim(),
      email: f.email.value.trim(),
      pesan: f.pesan.value.trim()
    });
    set('rezki_msgs', m);
    f.reset();
    toast('Pesan terkirim. Terima kasih!');
  };
  categories();
  grid();
  drawCart();
  return {refresh: () => {
    categories();
    grid();
    drawCart();
  }};
}

function initAdmin() {
  const on = () => sessionStorage.getItem('rezki_admin') === '1';
  const view = () => {
    $('#rezki_login').hidden = on();
    $('#rezki_dash').hidden = !on();
    if (on()) dash();
  };

  function dash() {
    const d = $('#rezki_tgl').value, S = sales.filter(s => tgl(s.t) === d);
    const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
    const pemasukan = sum(S, s => s.total);
    const pengeluaran = sum(S, s => sum(s.items, i => (Number(i.m) || 0) * i.q));
    $('#rezki_s_pendapatan').textContent = rp(pemasukan);
    $('#rezki_s_pengeluaran').textContent = rp(pengeluaran);
    $('#rezki_s_laba').textContent = rp(pemasukan - pengeluaran);
    $('#rezki_s_trx').textContent = S.length;
    $('#rezki_s_item').textContent = sum(S, s => sum(s.items, i => i.q));
    $('#rezki_print_date').textContent = new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {dateStyle: 'long'});
    $('#rezki_print_pemasukan').textContent = rp(pemasukan);
    $('#rezki_print_pengeluaran').textContent = rp(pengeluaran);
    $('#rezki_print_laba').textContent = rp(pemasukan - pengeluaran);
    $('#rezki_tbl_trx').innerHTML = S.length
      ? S.map(s => `<tr><td>${new Date(s.t).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</td><td>${s.items.map(i => esc(i.n) + ' x' + i.q).join(', ')}</td><td>${s.metode.toUpperCase()}</td><td>${rp(s.total)}</td></tr>`).join('')
      : '<tr><td colspan="4">Belum ada transaksi pada tanggal ini.</td></tr>';
    $('#rezki_tbl_stok').innerHTML = products.map(p => {
      const image = photoSrc(p);
      const preview = image ? `<img src="${image}" alt="Foto ${esc(p.n)}">` : '<span>Belum ada foto</span>';
      const remove = image ? `<button class="rezki_remove_photo" type="button" data-remove-photo="${p.id}">Hapus foto</button>` : '';
      return `<tr><td><input type="text" class="rezki_input_product" value="${esc(p.n)}" data-product="${p.id}" data-field="n" aria-label="Nama ${esc(p.n)}"></td><td><input type="number" min="1" step="1" class="rezki_input_product" value="${p.h}" data-product="${p.id}" data-field="h" aria-label="Harga jual ${esc(p.n)}"></td><td><input type="number" min="0" step="1" class="rezki_input_product" value="${p.m}" data-product="${p.id}" data-field="m" aria-label="Harga modal ${esc(p.n)}"></td><td><input type="number" min="0" step="1" class="rezki_input_stok" value="${p.s}" data-product="${p.id}" data-field="s" aria-label="Stok ${esc(p.n)}"></td><td>${p.s <= 10 ? '⚠️ Menipis' : 'Aman'}</td><td><div class="rezki_photo_admin">${preview}</div><label class="rezki_photo_upload" for="rezki_photo_${p.id}">Unggah / ganti foto<input id="rezki_photo_${p.id}" type="file" accept="image/*" data-photo="${p.id}"></label><small>Maks. 5 MB</small>${remove}</td></tr>`;
    }).join('');
    const agg = {};
    sales.forEach(s => s.items.forEach(i => {
      const a = agg[i.id] || (agg[i.id] = {id: i.id, n: i.n, q: 0, laba: 0});
      a.q += i.q;
      a.laba += (i.h - i.m) * i.q;
    }));
    const top = Object.values(agg).sort((a, b) => b.q - a.q).slice(0, 5), mx = top[0] ? top[0].q : 1;
    $('#rezki_tbl_top').innerHTML = top.length ? top.map(a => {
      const p = products.find(x => x.id === a.id), mg = p ? Math.round((p.h - p.m) / p.h * 100) : 0;
      return `<tr><td>${esc(a.n)}<div class="rezki_bar"><i style="width:${a.q / mx * 100}%"></i></div></td><td>${a.q}</td><td>${rp(a.laba)}</td><td>${mg}%</td></tr>`;
    }).join('') : '<tr><td colspan="4">Belum ada data penjualan.</td></tr>';
    const M = get('rezki_msgs', []);
    $('#rezki_pesan').innerHTML = M.length
      ? M.slice().reverse().map(m => `<li><b>${esc(m.nama)}</b> (${esc(m.email)})<br>${esc(m.pesan)}</li>`).join('')
      : '<li>Belum ada pesan masuk.</li>';
  }

  $('#rezki_login_form').onsubmit = e => {
    e.preventDefault();
    if ($('#rezki_user').value.trim() === 'admin' && $('#rezki_pass').value === 'admin123') {
      sessionStorage.setItem('rezki_admin', '1');
      $('#rezki_err').textContent = '';
      view();
    } else {
      $('#rezki_err').textContent = 'Username atau password salah.';
    }
  };
  $('#rezki_logout').onclick = () => {
    sessionStorage.removeItem('rezki_admin');
    view();
  };
  $('#rezki_print').onclick = () => {
    dash();
    document.body.classList.add('rezki_report_print');
    try {
      window.print();
    } finally {
      document.body.classList.remove('rezki_report_print');
    }
  };
  $('#rezki_reset').onclick = () => {
    if (confirm('Reset semua data demo (produk, transaksi, pesan)?')) {
      ['rezki_products', 'rezki_sales', 'rezki_cart', 'rezki_msgs'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  };
  $('#rezki_tgl').value = tgl(Date.now());
  $('#rezki_tgl').onchange = dash;
  $('#rezki_tbl_stok').onchange = async e => {
    const photoInput = e.target.closest('[data-photo]');
    if (photoInput) {
      const p = products.find(x => x.id == photoInput.dataset.photo), file = photoInput.files[0];
      if (!p || !file) return;
      try {
        const previous = p.image;
        p.image = await compressPhoto(file);
        if (!set('rezki_products', products)) {
          p.image = previous;
          toast('Foto gagal disimpan. Ruang penyimpanan browser mungkin penuh.');
          dash();
          return;
        }
        toast('Foto ' + p.n + ' berhasil diperbarui');
        dash();
        shop.refresh();
      } catch (error) {
        console.error('Gagal memproses foto produk.', error);
        toast(error.message || 'Foto gagal diproses.');
        photoInput.value = '';
      }
      return;
    }

    const i = e.target.closest('[data-product]');
    if (!i) return;
    const p = products.find(x => x.id == i.dataset.product);
    if (!p) return;
    const field = i.dataset.field, previous = p[field];
    if (field === 'n') {
      const name = i.value.trim();
      if (!name) {
        i.value = previous;
        return toast('Nama produk tidak boleh kosong.');
      }
      p.n = name;
    } else {
      const value = Number(i.value), min = field === 'h' ? 1 : 0;
      if (!Number.isInteger(value) || value < min) {
        i.value = previous;
        return toast(field === 'h' ? 'Harga jual harus lebih dari Rp0.' : 'Nilai harus berupa bilangan bulat positif.');
      }
      p[field] = value;
    }
    if (!set('rezki_products', products)) {
      p[field] = previous;
      i.value = previous;
      return toast('Perubahan produk gagal disimpan ke browser.');
    }
    toast('Produk ' + p.n + ' berhasil diperbarui');
    dash();
    shop.refresh();
  };
  $('#rezki_product_form').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const n = f.nama.value.trim(), c = f.kategori.value.trim();
    const h = Number(f.harga.value), m = Number(f.modal.value), s = Number(f.stok.value);
    if (!n || !c || !Number.isInteger(h) || h < 1 || !Number.isInteger(m) || m < 0 || !Number.isInteger(s) || s < 0) {
      return toast('Lengkapi data produk dengan nilai yang valid.');
    }
    const id = products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    products.push({id, n, c, h, m, s, e: '🛒'});
    if (!set('rezki_products', products)) {
      products.pop();
      return toast('Produk gagal disimpan ke browser.');
    }
    f.reset();
    toast('Produk ' + n + ' berhasil ditambahkan');
    dash();
    shop.refresh();
  };
  $('#rezki_tbl_stok').onclick = e => {
    const button = e.target.closest('[data-remove-photo]');
    if (!button) return;
    const p = products.find(x => x.id == button.dataset.removePhoto);
    if (!p) return;
    const previous = p.image;
    delete p.image;
    if (!set('rezki_products', products)) {
      p.image = previous;
      toast('Foto gagal dihapus dari penyimpanan browser.');
      return;
    }
    toast('Foto ' + p.n + ' berhasil dihapus');
    dash();
    shop.refresh();
  };
  view();
  return view;
}

const shop = initShop(), adm = initAdmin();
function setMode(a) {
  document.body.classList.toggle('rezki_mode_admin', a);
  document.body.classList.remove('rezki_cart_on');
  $('#rezki_menu').classList.remove('rezki_open');
  $('#rezki_shopview').hidden = a;
  $('#rezki_adminview').hidden = !a;
  $('#rezki_adminbtn').innerHTML = a ? '← Ke Toko' : '🔐 <span class="rezki_hide_m">Login&nbsp;</span>Admin';
  if (a) adm();
  else shop.refresh();
  window.scrollTo(0, 0);
}
$('#rezki_adminbtn').onclick = () => setMode(!document.body.classList.contains('rezki_mode_admin'));
$('#rezki_adminlink').onclick = e => {
  e.preventDefault();
  setMode(true);
};
