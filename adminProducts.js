function createAdminProductsController({ shared }) {
  const abrirProductoBtn = document.getElementById('btn-open-product');
  const modalNuevoProducto = document.getElementById('modal-nuevo-producto');
  const modalEditarProducto = document.getElementById('modal-editar-producto');
  const modalVenderProducto = document.getElementById('modal-vender-producto');
  const cuerpoProductos = document.getElementById('cuerpo-productos');
  const sinProductos = document.getElementById('sin-productos');
  const dashboardFecha = document.getElementById('dashboard-fecha');
  const tablaDashboardVentas = document.getElementById('tabla-dashboard-ventas');
  const dashboardSinVentas = document.getElementById('dashboard-sin-ventas');
  const widgetVentasHoy = document.getElementById('widget-ventas-hoy');

  const inputNuevoNombre = document.getElementById('producto-nuevo-nombre');
  const inputNuevoPrecio = document.getElementById('producto-nuevo-precio');
  const inputNuevoActivo = document.getElementById('producto-nuevo-activo');
  const guardarProductoBtn = document.getElementById('guardar-producto');
  const productNewLocationCopy = document.getElementById('product-new-location-copy');

  const inputEditarNombre = document.getElementById('producto-editar-nombre');
  const inputEditarPrecio = document.getElementById('producto-editar-precio');
  const inputEditarActivo = document.getElementById('producto-editar-activo');
  const guardarEdicionBtn = document.getElementById('guardar-producto-edicion');
  const eliminarProductoBtn = document.getElementById('eliminar-producto');

  const inputVentaNombre = document.getElementById('producto-venta-nombre');
  const inputVentaCantidad = document.getElementById('producto-venta-cantidad');
  const ventaTotalPreview = document.getElementById('producto-venta-total-preview');
  const guardarVentaBtn = document.getElementById('guardar-venta-producto');
  const sellSelectedButton = document.getElementById('product-sell-selected');
  const editSelectedButton = document.getElementById('product-edit-selected');
  const selectedProductCopy = document.querySelector('#product-local1-selection strong');
  const productSearch = document.getElementById('product-search');
  const productLocationButtons = Array.from(document.querySelectorAll('[data-product-location]'));
  const productsTotalCount = document.getElementById('products-total-count');
  const productsAvailableCount = document.getElementById('products-available-count');

  let productos = [];
  let productoSeleccionadoId = null;
  let productoVentaId = null;
  let productoVentaPrecio = 0;
  let productLocation = 'local1';

  function hoyYYYYMMDD() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  }

  function limpiarFormularioNuevo() {
    inputNuevoNombre.value = '';
    inputNuevoPrecio.value = '';
    if (inputNuevoActivo) inputNuevoActivo.checked = true;
    const locationLabel = productLocation === 'local2' ? 'Local 2' : 'Local 1';
    if (productNewLocationCopy) productNewLocationCopy.textContent = locationLabel;
    if (guardarProductoBtn) guardarProductoBtn.textContent = `Guardar en ${locationLabel}`;
  }

  async function asignarProductoCreado(producto, location) {
    if (location !== 'local2' || !producto?.id || !window.api?.transferirStockLocal) return;
    const info = window.api.obtenerInfoSistema ? await window.api.obtenerInfoSistema() : null;
    if (info?.dataMode === 'api') return;
    const stock = window.api.obtenerStockLocales ? await window.api.obtenerStockLocales() : [];
    const disponibilidad = (Array.isArray(stock) ? stock : []).find(item => Number(item.productoId) === Number(producto.id));
    const cantidadInicial = Math.max(1, Number(disponibilidad?.local1 || 0));
    await window.api.transferirStockLocal({
      productoId: Number(producto.id),
      cantidad: cantidadInicial,
      responsable: 'Recepción',
    });
  }

  function limpiarFormularioVenta() {
    inputVentaNombre.textContent = 'Producto';
    if (inputVentaCantidad) inputVentaCantidad.value = '1';
    if (ventaTotalPreview) ventaTotalPreview.textContent = formatearMoneda(0);
    document.querySelectorAll('input[name="producto-venta-forma-pago"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
  }

  function obtenerPagoVenta(total) {
    return {
      monto: total,
      formaPago: document.querySelector('input[name="producto-venta-forma-pago"]:checked')?.value || 'efectivo',
      observacion: null,
    };
  }

  async function cargarProductos() {
    if (window.api) {
      const [catalogo, stock] = await Promise.all([
        window.api.obtenerProductos(),
        window.api.obtenerStockLocales ? window.api.obtenerStockLocales() : Promise.resolve([]),
      ]);
      const stockPorProducto = new Map((Array.isArray(stock) ? stock : []).map(item => [Number(item.productoId), item]));
      productos = (Array.isArray(catalogo) ? catalogo : []).map(producto => {
        const disponibilidad = stockPorProducto.get(Number(producto.id));
        return {
          ...producto,
          local1: Number(disponibilidad?.local1 ?? (Number(producto.activo) !== 0 ? 1 : 0)),
          local2: Number(disponibilidad?.local2 ?? 0),
          asignadoLocal2: Number(disponibilidad?.asignadoLocal2 ?? (Number(disponibilidad?.local2) > 0 ? 1 : 0)),
        };
      });
    } else {
      productos = [
        { id: 1, nombre: 'Agua mineral 1.5 L', precio: 95, activo: true, local1: 18, local2: 6, asignadoLocal2: 1 },
        { id: 2, nombre: 'Agua mineral 600 ml', precio: 60, activo: true, local1: 38, local2: 0, asignadoLocal2: 1 },
      ];
    }
    if (!productos.some(item => Number(item.id) === Number(productoSeleccionadoId))) productoSeleccionadoId = null;
    renderizarProductos();
  }

  function updateSelectedProduct() {
    const selected = productos.find(item => Number(item.id) === Number(productoSeleccionadoId));
    if (selectedProductCopy) selectedProductCopy.textContent = selected?.nombre || 'Ninguno';
    if (sellSelectedButton) {
      sellSelectedButton.disabled = !selected || Number(selected.activo) === 0 || Number(selected?.[productLocation]) <= 0 || productLocation !== 'local1';
      sellSelectedButton.title = productLocation === 'local2' ? 'Las ventas del Local 2 se registran desde la tablet' : '';
    }
    if (editSelectedButton) editSelectedButton.disabled = !selected;
    cuerpoProductos.querySelectorAll('[data-product-row]').forEach(row => {
      row.classList.toggle('is-selected', Number(row.dataset.productRow) === Number(productoSeleccionadoId));
      row.setAttribute('aria-pressed', String(Number(row.dataset.productRow) === Number(productoSeleccionadoId)));
    });
  }

  async function setProductLocation(producto, local, assigned) {
    const field = local === 'local1' ? 'availableLocal1' : 'availableLocal2';
    await window.api.actualizarProducto(producto.id, {
      nombre: producto.nombre, precio: producto.precio, activo: producto.activo,
      [field]: assigned,
    });
    await cargarProductos();
    shared.mostrarNotificacion(assigned ? 'Producto agregado al local' : 'Producto retirado del local', 'success');
    document.dispatchEvent(new CustomEvent('stock:updated'));
  }

  function renderizarProductos() {
    const query = productSearch?.value.trim().toLocaleLowerCase('es') || '';
    if (productsTotalCount) productsTotalCount.textContent = String(productos.length);
    if (productsAvailableCount) productsAvailableCount.textContent = String(productos.filter(x => x.activo && (Number(x.local1) > 0 || Number(x.local2) > 0)).length);
    cuerpoProductos.replaceChildren();
    sinProductos.style.display = 'none';
    for (const [local, title] of [['local1', 'Local 1'], ['local2', 'Local 2']]) {
      const section = document.createElement('section');
      section.className = 'product-location-table';
      const rows = productos.filter(x => Number(x[local]) > 0 && (!query || x.nombre.toLocaleLowerCase('es').includes(query)));
      const header = document.createElement('header'); header.className = 'product-location-heading';
      const identity = document.createElement('div'); identity.className = 'product-location-identity';
      const heading = document.createElement('h3'); heading.textContent = title;
      heading.id = 'product-heading-' + local; section.setAttribute('aria-labelledby', heading.id);
      const count = document.createElement('span'); count.className = 'product-location-count'; count.textContent = `${rows.length} ${rows.length === 1 ? 'producto' : 'productos'}`;
      identity.append(heading, count); header.append(identity);
      const toolbar = document.createElement('div'); toolbar.className = 'product-location-actions';
      toolbar.id = 'product-add-' + local; toolbar.hidden = true; toolbar.dataset.productAddPanel = local;
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'app-button product-add-toggle';
      toggle.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i><span>Agregar producto</span>';
      toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', toolbar.id);
      toggle.setAttribute('aria-label', 'Agregar producto a ' + title);
      toggle.onclick = () => { toolbar.hidden = !toolbar.hidden; toggle.setAttribute('aria-expanded', String(!toolbar.hidden)); if (!toolbar.hidden) select.focus(); };
      header.append(toggle); section.append(header);
      const select = document.createElement('select'); select.setAttribute('aria-label', 'Agregar producto existente a ' + title);
      select.className = 'app-select';
      const placeholder = new Option('Elegir producto existente', ''); select.add(placeholder);
      productos.filter(x => !Number(x[local])).forEach(x => select.add(new Option(x.nombre, x.id)));
      const add = document.createElement('button'); add.type = 'button'; add.className = 'app-button'; add.textContent = 'Agregar'; add.disabled = true;
      select.onchange = () => { add.disabled = !select.value; };
      add.onclick = async () => {
        const item = productos.find(x => String(x.id) === select.value); if (!item) return;
        add.disabled = true;
        try { await setProductLocation(item, local, true); }
        catch (error) { shared.mostrarNotificacion(error.message, 'error'); add.disabled = false; }
      };
      const create = document.createElement('button'); create.type = 'button'; create.className = 'app-button product-create-action'; create.textContent = 'Crear nuevo producto';
      create.onclick = () => { productLocation = local; limpiarFormularioNuevo(); modalNuevoProducto.style.display = 'flex'; inputNuevoNombre.focus(); };
      toolbar.append(select, add, create); section.append(toolbar);
      toolbar.addEventListener('keydown', event => { if (event.key === 'Escape') { toolbar.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
      const table = document.createElement('table'); table.setAttribute('aria-label', 'Productos de ' + title);
      table.className = 'data-table product-location-data';
      table.innerHTML = '<thead><tr><th scope="col">Producto</th><th scope="col">Precio</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const item of rows) {
        const row = document.createElement('tr');
        for (const value of [item.nombre, formatearMoneda(item.precio), item.activo ? 'Disponible' : 'No disponible']) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        row.cells[0].className = 'product-name-cell'; row.cells[1].className = 'product-price-cell';
        row.cells[2].className = 'product-state-cell' + (item.activo ? ' is-available' : '');
        const actions = document.createElement('td');
        const actionGroup = document.createElement('div'); actionGroup.className = 'product-row-actions';
        for (const [label, action] of [
          ['Vender', () => abrirVentaProducto(item.id)],
          ['Editar', () => abrirEdicionProducto(item.id)],
          ['Quitar del local', async button => {
            if (!await shared.confirmarAccion('¿Quitar ' + item.nombre + ' de ' + title + '? Sus ventas anteriores se conservan.')) return;
            button.disabled = true;
            try { await setProductLocation(item, local, false); }
            catch (error) { shared.mostrarNotificacion(error.message, 'error'); button.disabled = false; }
          }],
        ]) {
          const button = document.createElement('button'); button.type = 'button';
          button.className = label === 'Vender' ? 'product-row-sell' : 'product-row-icon';
          const icon = document.createElement('i'); icon.setAttribute('aria-hidden', 'true');
          icon.className = 'fa-solid ' + (label === 'Vender' ? 'fa-cart-shopping' : label === 'Editar' ? 'fa-pen' : 'fa-trash-can');
          const text = document.createElement('span'); text.textContent = label;
          if (label !== 'Vender') text.className = 'sr-only';
          button.append(icon, text); button.title = label;
          if (label === 'Quitar del local') button.classList.add('is-remove');
          button.setAttribute('aria-label', label + ': ' + item.nombre + ', ' + title);
          if (label === 'Vender') button.disabled = !item.activo;
          button.onclick = () => { productLocation = local; productoSeleccionadoId = item.id; action(button); };
          actionGroup.append(button);
        }
        actions.append(actionGroup);
        row.append(actions); body.append(row);
      }
      if (!rows.length) { const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan = 4; cell.className = 'product-location-empty'; cell.textContent = query ? 'No hay productos que coincidan con la búsqueda.' : 'Todavía no hay productos en este local.'; }
      const scroll = document.createElement('div'); scroll.className = 'product-location-scroll';
      table.append(body); scroll.append(table); section.append(scroll); cuerpoProductos.append(section);
    }
  }

  async function renderizarVentasDashboard(fecha = dashboardFecha?.value || hoyYYYYMMDD()) {
    if (!tablaDashboardVentas || !dashboardSinVentas) return;

    const ventasDelDia = window.api ? await window.api.obtenerVentasProductos(fecha) : [];
    tablaDashboardVentas.innerHTML = '';
    dashboardSinVentas.style.display = ventasDelDia.length === 0 ? 'block' : 'none';

    ventasDelDia.forEach(venta => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${venta.hora}</td>
        <td>${venta.nombre}</td>
        <td>${venta.cantidad}</td>
        <td>${formatearMoneda(venta.total)}</td>
      `;
      tablaDashboardVentas.appendChild(tr);
    });
  }

  async function actualizarWidgetVentasHoy() {
    if (!widgetVentasHoy) return;
    if (!window.api) return;
    const resumen = await window.api.obtenerResumenCajaDia(hoyYYYYMMDD());
    widgetVentasHoy.textContent = formatearMoneda(resumen?.totalIngresos || 0);
  }

  function abrirEdicionProducto(id) {
    const producto = productos.find(item => String(item.id) === String(id));
    if (!producto) return;

    productoSeleccionadoId = producto.id;
    inputEditarNombre.value = producto.nombre;
    inputEditarPrecio.value = producto.precio;
    if (inputEditarActivo) inputEditarActivo.checked = Number(producto.activo) !== 0;
    modalEditarProducto.style.display = 'flex';
    if (eliminarProductoBtn) eliminarProductoBtn.textContent = 'Quitar del local';
    updateSelectedProduct();
  }

  function abrirVentaProducto(id) {
    const producto = productos.find(item => String(item.id) === String(id));
    if (!producto) return;

    productoVentaId = producto.id;
    productoVentaPrecio = Number(producto.precio || 0);
    if (Number(producto.activo) === 0) {
      shared.mostrarNotificacion('El producto no esta disponible', 'warning');
      return;
    }
    limpiarFormularioVenta();
    inputVentaNombre.textContent = producto.nombre;
    actualizarTotalVenta();
    modalVenderProducto.style.display = 'flex';
  }

  function actualizarTotalVenta() {
    const cantidad = Math.max(1, Number.parseInt(inputVentaCantidad?.value || '1', 10));
    if (inputVentaCantidad) inputVentaCantidad.value = String(cantidad);
    const total = productoVentaPrecio * cantidad;
    if (ventaTotalPreview) ventaTotalPreview.textContent = formatearMoneda(total);
  }

  async function venderProductoSeleccionado() {
    if (!productoVentaId) return;

    const cantidad = Math.max(1, Number.parseInt(inputVentaCantidad?.value || '1', 10));
    const total = productoVentaPrecio * cantidad;
    const pago = obtenerPagoVenta(total);

    try {
      await window.api.venderProducto({ id: Number(productoVentaId), quantity: cantidad, payment: pago });
      modalVenderProducto.style.display = 'none';
      shared.mostrarNotificacion('Venta registrada', 'success');
      document.dispatchEvent(new CustomEvent('cash:updated'));
      document.dispatchEvent(new CustomEvent('stock:updated'));
      await cargarProductos();
      await renderizarVentasDashboard();
      await actualizarWidgetVentasHoy();
    } catch (error) {
      console.error(error);
      shared.mostrarNotificacion(
        error?.message?.includes('stock') ? error.message : (error?.message || 'No se pudo registrar la venta'),
        'warning'
      );
    }
  }

  async function crearProducto() {
    const nombre = inputNuevoNombre.value.trim();
    const precio = Number(inputNuevoPrecio.value);
    const targetLocation = productLocation;

    if (!nombre || Number.isNaN(precio) || precio < 0) {
      shared.mostrarNotificacion('Completa nombre y precio', 'warning');
      return;
    }

    let productoCreado = null;
    try {
      productoCreado = await window.api.crearProducto({ nombre, precio, activo: inputNuevoActivo?.checked !== false, availableLocal1: targetLocation === 'local1', availableLocal2: targetLocation === 'local2' });
      await asignarProductoCreado(productoCreado, targetLocation);
      productoSeleccionadoId = Number(productoCreado?.id) || null;
      limpiarFormularioNuevo();
      modalNuevoProducto.style.display = 'none';
      shared.mostrarNotificacion(`Producto agregado a ${targetLocation === 'local2' ? 'Local 2' : 'Local 1'}`, 'success');
      await cargarProductos();
      await actualizarWidgetVentasHoy();
      document.dispatchEvent(new CustomEvent('stock:updated'));
    } catch (error) {
      console.error(error);
      shared.mostrarNotificacion(productoCreado?.id
        ? 'El producto se creó, pero no se pudo actualizar la lista. Actualizá la pantalla antes de volver a crearlo.'
        : `No se pudo agregar el producto a ${targetLocation === 'local2' ? 'Local 2' : 'Local 1'}`, 'error');
    }
  }

  async function guardarEdicionProducto() {
    const nombre = inputEditarNombre.value.trim();
    const precio = Number(inputEditarPrecio.value);

    if (!nombre || Number.isNaN(precio) || precio < 0) {
      shared.mostrarNotificacion('Completa los datos del producto', 'warning');
      return;
    }

    try {
      await window.api.actualizarProducto(productoSeleccionadoId, {
        nombre,
        precio,
        activo: inputEditarActivo?.checked !== false,
      });
      modalEditarProducto.style.display = 'none';
      shared.mostrarNotificacion('Producto actualizado', 'success');
      await cargarProductos();
      document.dispatchEvent(new CustomEvent('stock:updated'));
    } catch (error) {
      console.error(error);
      shared.mostrarNotificacion('No se pudo actualizar el producto', 'error');
    }
  }

  async function eliminarProducto() {
    if (!productoSeleccionadoId) return;

    const confirmado = await shared.confirmAction({
      message: '¿Quitar este producto de ' + (productLocation === 'local1' ? 'Local 1' : 'Local 2') + '? Las ventas anteriores se conservan.',
      onConfirm: async () => {
        await setProductLocation(productos.find(x => Number(x.id) === Number(productoSeleccionadoId)), productLocation, false);
        modalEditarProducto.style.display = 'none';
        shared.mostrarNotificacion('Producto retirado del local', 'success');
        await cargarProductos();
        document.dispatchEvent(new CustomEvent('stock:updated'));
      },
    });

    if (!confirmado) {
      shared.mostrarNotificacion('Eliminacion cancelada', 'warning');
    }
  }

  async function init() {
    window.adminSync?.watch({
      enabled: () => Boolean(window.api && window.adminSync.active('products') && !cuerpoProductos.querySelector('[data-product-add-panel]:not([hidden])')),
      read: () => Promise.all([window.api.obtenerProductos(), window.api.obtenerStockLocales()]),
      apply: ([catalogo, stock]) => {
        const stocks = new Map(stock.map(item => [Number(item.productoId), item]));
        productos = catalogo.map(producto => {
          const row = stocks.get(Number(producto.id));
          return { ...producto, local1: Number(row?.local1 ?? 0), local2: Number(row?.local2 ?? 0),
            asignadoLocal2: Number(row?.asignadoLocal2 ?? 0) };
        });
        if (!productos.some(item => Number(item.id) === Number(productoSeleccionadoId))) productoSeleccionadoId = null;
        renderizarProductos();
      },
    });
    await cargarProductos();
    await renderizarVentasDashboard();
    await actualizarWidgetVentasHoy();

    abrirProductoBtn?.addEventListener('click', limpiarFormularioNuevo);
    document.querySelectorAll('[data-open-modal="modal-nuevo-producto"]').forEach(button => button.addEventListener('click', limpiarFormularioNuevo));
    guardarProductoBtn?.addEventListener('click', crearProducto);
    guardarEdicionBtn?.addEventListener('click', guardarEdicionProducto);
    eliminarProductoBtn?.addEventListener('click', eliminarProducto);
    inputVentaCantidad?.addEventListener('input', actualizarTotalVenta);
    guardarVentaBtn?.addEventListener('click', venderProductoSeleccionado);
    sellSelectedButton?.addEventListener('click', () => abrirVentaProducto(productoSeleccionadoId));
    editSelectedButton?.addEventListener('click', () => abrirEdicionProducto(productoSeleccionadoId));
    productSearch?.addEventListener('input', renderizarProductos);
    productLocationButtons.forEach(button => button.addEventListener('click', () => {
      productLocation = button.dataset.productLocation || 'local1';
      productLocationButtons.forEach(option => option.classList.toggle('is-active', option === button));
      renderizarProductos();
    }));
    document.addEventListener('product:sell', event => abrirVentaProducto(event.detail?.id));
    document.addEventListener('stock:updated', cargarProductos);
    document.addEventListener('admin-dashboard:show', async () => {
      await renderizarVentasDashboard();
      await actualizarWidgetVentasHoy();
    });

    document.addEventListener('admin-dashboard:date-change', async event => {
      await renderizarVentasDashboard(event.detail?.date);
    });
  }

  return {
    init,
  };
}

window.createAdminProductsController = createAdminProductsController;
