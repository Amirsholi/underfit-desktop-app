function createHomeDashboardController({ shared }) {
  const searchInput = document.getElementById('home-member-search');
  const productSearchInput = document.getElementById('home-product-search');
  const membersList = document.getElementById('home-members-list');
  const membersEmpty = document.getElementById('home-members-empty');
  const productsList = document.getElementById('home-products-list');
  const productsEmpty = document.getElementById('home-products-empty');
  const todayLabel = document.getElementById('home-today-label');
  let members = [];
  let products = [];

  function money(value) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function initials(name = '') {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'UF';
  }

  function signedDays(expirationDate) {
    const expiration = window.membershipRules?.parseLocalDate(expirationDate);
    const reference = window.membershipRules?.todayLocal();
    if (!expiration || !reference) return 0;
    return Math.round((expiration - reference) / (24 * 60 * 60 * 1000));
  }

  function renderMembers(filter = '') {
    if (!membersList || !membersEmpty) return;
    const query = filter.trim().toLocaleLowerCase('es');
    const visible = shared.ordenarSociosPorVencimiento(members)
      .filter(member => !query || String(member?.ci || '').includes(query) || String(member?.nombre || '').toLocaleLowerCase('es').includes(query));
    membersList.innerHTML = '';
    membersEmpty.style.display = visible.length ? 'none' : 'grid';

    visible.forEach(member => {
      const days = signedDays(member?.fecha_vencimiento);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'home-member-row home-member-columns';
      row.innerHTML = `
        <span class="home-person"><span class="home-avatar"></span><span class="home-person-name"></span></span>
        <span class="home-member-date"></span>
        <span class="home-member-state"><strong></strong><i class="fa-solid fa-chevron-right"></i></span>
      `;
      row.querySelector('.home-avatar').textContent = initials(member?.nombre);
      row.querySelector('.home-person-name').textContent = member?.nombre || 'Sin nombre';
      row.querySelector('.home-member-date').textContent = member?.fecha_vencimiento || '-';
      const dayValue = row.querySelector('.home-member-state strong');
      dayValue.textContent = `${days} días`;
      dayValue.classList.toggle('is-warning', days >= 0 && days <= 7);
      dayValue.classList.toggle('is-expired', days < 0);
      row.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('member:open', { detail: { ci: member?.ci } }));
      });
      membersList.appendChild(row);
    });
  }

  function renderProducts(filter = '') {
    if (!productsList || !productsEmpty) return;
    const query = filter.trim().toLocaleLowerCase('es');
    const visible = products
      .filter(product => Number(product?.activo) !== 0)
      .filter(product => !query || String(product?.nombre || '').toLocaleLowerCase('es').includes(query));
    productsList.innerHTML = '';
    productsEmpty.style.display = visible.length ? 'none' : 'grid';

    visible.forEach(product => {
      const row = document.createElement('div');
      row.className = 'home-product-row home-product-columns';
      row.innerHTML = `
        <span class="home-product-name"><span></span></span>
        <span class="home-product-price"></span>
        <button class="home-quick-sale" type="button" aria-label="Vender producto"><span>Vender</span></button>
      `;
      row.querySelector('.home-product-name span').textContent = product?.nombre || 'Producto';
      row.querySelector('.home-product-price').textContent = money(product?.precio);
      const sellButton = row.querySelector('.home-quick-sale');
      const available = Number(product?.activo) !== 0 && (product?.stock == null || Number(product.stock) > 0);
      sellButton.disabled = !available;
      sellButton.querySelector('span').textContent = available ? 'Vender' : 'Sin stock';
      sellButton.setAttribute('aria-label', available ? `Vender ${product?.nombre || 'producto'}` : `${product?.nombre || 'Producto'} sin stock`);
      sellButton.addEventListener('click', () => {
        if (!available) return;
        document.dispatchEvent(new CustomEvent('product:sell', { detail: { id: product?.id } }));
        if (!window.api) {
          document.getElementById('producto-venta-nombre').textContent = product?.nombre || 'Producto';
          document.getElementById('producto-venta-cantidad').value = '1';
          document.getElementById('producto-venta-total-preview').textContent = money(Number(product?.precio || 0));
          document.getElementById('modal-vender-producto').style.display = 'flex';
        }
      });
      productsList.appendChild(row);
    });
  }

  async function refresh() {
    if (!window.api) {
      members = [
        { ci: '49876543', nombre: 'Martina Silva', fecha_vencimiento: '2026-08-11' },
        { ci: '43219876', nombre: 'Bruno Rodriguez', fecha_vencimiento: '2026-08-20' },
        { ci: '51234567', nombre: 'Lucas Pereira', fecha_vencimiento: '2026-08-30' },
        { ci: '56781234', nombre: 'Diego Martinez', fecha_vencimiento: '2026-10-16' },
        { ci: '37654321', nombre: 'Camila Fernandez', fecha_vencimiento: '2027-02-26' },
        { ci: '40127896', nombre: 'Valentina Suarez', fecha_vencimiento: '2026-07-01' },
      ];
      renderMembers('');
      products = [
        { id: 1, nombre: 'Agua mineral 1.5 L', precio: 95, stock: 18 },
        { id: 2, nombre: 'Agua mineral 600 ml', precio: 60, stock: 38 },
        { id: 3, nombre: 'Agua saborizada 500 ml', precio: 85, stock: 22 },
        { id: 4, nombre: 'Barrita de cereal chocolate', precio: 70, stock: 28 },
        { id: 5, nombre: 'Barrita de cereal frutos rojos', precio: 70, stock: 24 },
        { id: 6, nombre: 'Bebida isotonica 500 ml', precio: 120, stock: 16 },
        { id: 7, nombre: 'Bebida energética sin azúcar', precio: 145, stock: 20 },
        { id: 8, nombre: 'Proteína individual chocolate', precio: 180, stock: 14 },
        { id: 9, nombre: 'Proteína individual vainilla', precio: 180, stock: 12 },
        { id: 10, nombre: 'Toalla deportiva', precio: 390, stock: 9 },
        { id: 11, nombre: 'Banda elástica media', precio: 480, stock: 8 },
        { id: 12, nombre: 'Shaker Under-Fit', precio: 520, stock: 11 },
      ];
      renderProducts('');
      document.getElementById('contador-usuarios').textContent = '5';
      document.getElementById('widget-ingresos-hoy').textContent = '7';
      document.getElementById('widget-ventas-hoy').textContent = '$ 10.545';
      return;
    }
    try {
      const [users, productRows] = await Promise.all([
        window.api.obtenerUsuarios(),
        window.api.obtenerProductos(),
      ]);
      members = Array.isArray(users) ? users : [];
      products = Array.isArray(productRows) ? productRows : [];
      renderMembers(searchInput?.value || '');
      renderProducts(productSearchInput?.value || '');
    } catch (error) {
      console.error('No se pudo cargar el centro operativo:', error);
      renderMembers('');
      products = [];
      renderProducts('');
    }
  }

  function init() {
    window.adminSync?.watch({
      enabled: () => Boolean(window.api && window.adminSync.active('home')),
      read: () => Promise.all([window.api.obtenerUsuarios(), window.api.obtenerProductos()]),
      apply: ([users, rows]) => {
        members = users; products = rows;
        renderMembers(searchInput?.value || ''); renderProducts(productSearchInput?.value || '');
      },
    });
    if (todayLabel) {
      todayLabel.textContent = new Intl.DateTimeFormat('es-UY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    }
    searchInput?.addEventListener('input', () => renderMembers(searchInput.value));
    productSearchInput?.addEventListener('input', () => renderProducts(productSearchInput.value));
    document.addEventListener('admin-home:show', refresh);
    refresh();
    if (!window.api) setTimeout(refresh, 250);
  }

  return { init, refresh };
}

window.createHomeDashboardController = createHomeDashboardController;
