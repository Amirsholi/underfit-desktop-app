function createHomeDashboardController({ shared }) {
  const searchInput = document.getElementById('home-member-search');
  const membersList = document.getElementById('home-members-list');
  const membersEmpty = document.getElementById('home-members-empty');
  const productsList = document.getElementById('home-products-list');
  const productsEmpty = document.getElementById('home-products-empty');
  const todayLabel = document.getElementById('home-today-label');
  let members = [];

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

  function renderMembers(filter = '') {
    if (!membersList || !membersEmpty) return;
    const query = filter.trim().toLocaleLowerCase('es');
    const visible = shared.ordenarSociosPorVencimiento(members)
      .filter(member => !query || String(member?.ci || '').includes(query) || String(member?.nombre || '').toLocaleLowerCase('es').includes(query))
      .slice(0, 6);
    membersList.innerHTML = '';
    membersEmpty.style.display = visible.length ? 'none' : 'grid';

    visible.forEach(member => {
      const days = shared.calcularDiasRestantes(member?.fecha_vencimiento);
      const active = shared.esMembresiaActiva(member?.fecha_vencimiento);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'home-member-row home-member-columns';
      row.innerHTML = `
        <span class="home-person"><span class="home-avatar"></span><span class="home-person-name"></span></span>
        <span class="home-member-date"></span>
        <span class="home-member-state"><span class="home-active-pill"></span><strong></strong><i class="fa-solid fa-chevron-right"></i></span>
      `;
      row.querySelector('.home-avatar').textContent = initials(member?.nombre);
      row.querySelector('.home-person-name').textContent = member?.nombre || 'Sin nombre';
      row.querySelector('.home-member-date').textContent = member?.fecha_vencimiento || '-';
      row.querySelector('.home-member-state strong').textContent = `${days} dias`;
      const status = row.querySelector('.home-active-pill');
      status.textContent = active && days === 0 ? 'Vence hoy' : active ? 'Activo' : 'Vencido';
      status.classList.toggle('is-warning', active && days === 0);
      status.classList.toggle('is-expired', !active);
      row.addEventListener('click', () => document.querySelector(`#cuerpo-usuarios [data-ci="${CSS.escape(String(member?.ci || ''))}"]`)?.click());
      membersList.appendChild(row);
    });
  }

  function renderProducts(products) {
    if (!productsList || !productsEmpty) return;
    const visible = (Array.isArray(products) ? products : []).filter(product => Number(product?.stock || 0) > 0).slice(0, 6);
    productsList.innerHTML = '';
    productsEmpty.style.display = visible.length ? 'none' : 'grid';

    visible.forEach(product => {
      const row = document.createElement('div');
      row.className = 'home-product-row home-product-columns';
      row.innerHTML = `
        <span class="home-product-name"><span></span></span>
        <span class="home-product-price"></span>
        <strong class="home-product-stock"></strong>
        <button class="home-quick-sale" type="button" aria-label="Vender producto"><span>Vender</span></button>
      `;
      row.querySelector('.home-product-name span').textContent = product?.nombre || 'Producto';
      row.querySelector('.home-product-price').textContent = money(product?.precio);
      row.querySelector('.home-product-stock').textContent = String(product?.stock ?? 0);
      row.querySelector('.home-quick-sale').addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('product:sell', { detail: { id: product?.id } }));
        if (window.api) return;
        if (!window.api) {
          document.getElementById('producto-venta-nombre').value = product?.nombre || '';
          document.getElementById('producto-venta-cantidad').value = '1';
          document.getElementById('producto-venta-monto').value = String(Number(product?.precio || 0));
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
      renderProducts([
        { id: 1, nombre: 'Agua mineral 1.5 L', precio: 95, stock: 18 },
        { id: 2, nombre: 'Agua mineral 600 ml', precio: 60, stock: 38 },
        { id: 3, nombre: 'Agua saborizada 500 ml', precio: 85, stock: 22 },
        { id: 4, nombre: 'Barrita de cereal chocolate', precio: 70, stock: 28 },
        { id: 5, nombre: 'Barrita de cereal frutos rojos', precio: 70, stock: 24 },
        { id: 6, nombre: 'Bebida isotonica 500 ml', precio: 120, stock: 16 },
      ]);
      document.getElementById('contador-usuarios').textContent = '5';
      document.getElementById('widget-ingresos-hoy').textContent = '7';
      document.getElementById('widget-ventas-hoy').textContent = '$ 10.545';
      return;
    }
    try {
      const [users, products] = await Promise.all([
        window.api.obtenerUsuarios(),
        window.api.obtenerProductos(),
      ]);
      members = Array.isArray(users) ? users : [];
      renderMembers(searchInput?.value || '');
      renderProducts(products);
    } catch (error) {
      console.error('No se pudo cargar el centro operativo:', error);
      renderMembers('');
      renderProducts([]);
    }
  }

  function init() {
    if (todayLabel) {
      todayLabel.textContent = new Intl.DateTimeFormat('es-UY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    }
    searchInput?.addEventListener('input', () => renderMembers(searchInput.value));
    document.addEventListener('admin-home:show', refresh);
    refresh();
    if (!window.api) setTimeout(refresh, 250);
  }

  return { init, refresh };
}

window.createHomeDashboardController = createHomeDashboardController;
