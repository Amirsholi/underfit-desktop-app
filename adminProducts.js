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
  const inputNuevoStock = document.getElementById('producto-nuevo-stock');
  const guardarProductoBtn = document.getElementById('guardar-producto');

  const inputEditarNombre = document.getElementById('producto-editar-nombre');
  const inputEditarPrecio = document.getElementById('producto-editar-precio');
  const inputEditarStock = document.getElementById('producto-editar-stock');
  const inputEditarSumarStock = document.getElementById('producto-editar-sumar-stock');
  const guardarEdicionBtn = document.getElementById('guardar-producto-edicion');
  const eliminarProductoBtn = document.getElementById('eliminar-producto');

  const inputVentaNombre = document.getElementById('producto-venta-nombre');
  const inputVentaCantidad = document.getElementById('producto-venta-cantidad');
  const inputVentaMonto = document.getElementById('producto-venta-monto');
  const ventaTotalPreview = document.getElementById('producto-venta-total-preview');
  const inputVentaObservacion = document.getElementById('producto-venta-observacion');
  const guardarVentaBtn = document.getElementById('guardar-venta-producto');
  const sellSelectedButton = document.getElementById('product-sell-selected');
  const editSelectedButton = document.getElementById('product-edit-selected');
  const selectedProductCopy = document.querySelector('#product-local1-selection strong');
  const locationTabs = Array.from(document.querySelectorAll('[data-product-location]'));
  const locationPanels = Array.from(document.querySelectorAll('[data-product-location-panel]'));

  let productos = [];
  let productoSeleccionadoId = null;
  let productoVentaId = null;
  let productoVentaPrecio = 0;
  let productoVentaStock = 0;

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
    inputNuevoStock.value = '';
  }

  function limpiarFormularioVenta() {
    inputVentaNombre.value = '';
    if (inputVentaCantidad) inputVentaCantidad.value = '1';
    inputVentaMonto.value = '';
    if (ventaTotalPreview) ventaTotalPreview.textContent = formatearMoneda(0);
    inputVentaObservacion.value = '';
    document.querySelectorAll('input[name="producto-venta-forma-pago"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
  }

  function obtenerPagoVenta() {
    return {
      monto: Number(inputVentaMonto.value || 0),
      formaPago: document.querySelector('input[name="producto-venta-forma-pago"]:checked')?.value || 'efectivo',
      observacion: inputVentaObservacion.value.trim(),
    };
  }

  async function cargarProductos() {
    productos = window.api ? await window.api.obtenerProductos() : [
      { id: 1, nombre: 'Agua mineral 1.5 L', precio: 95, stock: 18 },
      { id: 2, nombre: 'Agua mineral 600 ml', precio: 60, stock: 38 },
      { id: 3, nombre: 'Agua saborizada 500 ml', precio: 85, stock: 22 },
      { id: 4, nombre: 'Barrita de cereal chocolate', precio: 70, stock: 28 },
      { id: 5, nombre: 'Barrita de cereal frutos rojos', precio: 70, stock: 24 },
      { id: 6, nombre: 'Bebida isotonica 500 ml', precio: 120, stock: 16 },
    ];
    if (!productos.some(item => Number(item.id) === Number(productoSeleccionadoId))) productoSeleccionadoId = null;
    renderizarProductos();
  }

  function updateSelectedProduct() {
    const selected = productos.find(item => Number(item.id) === Number(productoSeleccionadoId));
    if (selectedProductCopy) selectedProductCopy.textContent = selected?.nombre || 'Ninguno';
    if (sellSelectedButton) sellSelectedButton.disabled = !selected;
    if (editSelectedButton) editSelectedButton.disabled = !selected;
    cuerpoProductos.querySelectorAll('[data-product-row]').forEach(row => {
      row.classList.toggle('is-selected', Number(row.dataset.productRow) === Number(productoSeleccionadoId));
    });
  }

  function renderizarProductos() {
    cuerpoProductos.innerHTML = '';
    sinProductos.style.display = productos.length === 0 ? 'block' : 'none';

    productos.forEach(producto => {
      const tr = document.createElement('tr');
      tr.dataset.productRow = String(producto.id);
      tr.tabIndex = 0;
      tr.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.precio}</td>
        <td>${producto.stock}</td>
      `;
      tr.addEventListener('click', () => {
        productoSeleccionadoId = producto.id;
        updateSelectedProduct();
      });
      tr.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        productoSeleccionadoId = producto.id;
        updateSelectedProduct();
      });
      cuerpoProductos.appendChild(tr);
    });
    updateSelectedProduct();
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
    inputEditarStock.value = producto.stock;
    inputEditarSumarStock.value = '';
    modalEditarProducto.style.display = 'flex';
    updateSelectedProduct();
  }

  function abrirVentaProducto(id) {
    const producto = productos.find(item => String(item.id) === String(id));
    if (!producto) return;

    productoVentaId = producto.id;
    productoVentaPrecio = Number(producto.precio || 0);
    productoVentaStock = Number(producto.stock || 0);
    limpiarFormularioVenta();
    inputVentaNombre.value = producto.nombre;
    actualizarTotalVenta();
    modalVenderProducto.style.display = 'flex';
  }

  function actualizarTotalVenta() {
    const cantidad = Math.max(1, Number.parseInt(inputVentaCantidad?.value || '1', 10));
    if (inputVentaCantidad) inputVentaCantidad.value = String(cantidad);
    const total = productoVentaPrecio * cantidad;
    inputVentaMonto.value = String(total);
    if (ventaTotalPreview) ventaTotalPreview.textContent = formatearMoneda(total);
  }

  async function venderProductoSeleccionado() {
    if (!productoVentaId) return;

    const cantidad = Math.max(1, Number.parseInt(inputVentaCantidad?.value || '1', 10));
    if (cantidad > productoVentaStock) {
      shared.mostrarNotificacion('No hay stock suficiente', 'warning');
      return;
    }

    const pago = obtenerPagoVenta();
    if (Number.isNaN(pago.monto) || pago.monto <= 0) {
      shared.mostrarNotificacion('Ingresa un monto valido', 'warning');
      return;
    }

    try {
      await window.api.venderProducto({ id: Number(productoVentaId), quantity: cantidad, payment: pago });
      modalVenderProducto.style.display = 'none';
      shared.mostrarNotificacion('Venta registrada', 'success');
      await cargarProductos();
      await renderizarVentasDashboard();
      await actualizarWidgetVentasHoy();
      document.dispatchEvent(new CustomEvent('cash:updated'));
      document.dispatchEvent(new CustomEvent('stock:updated'));
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
    const stock = Number(inputNuevoStock.value);

    if (!nombre || Number.isNaN(precio) || Number.isNaN(stock) || precio < 0 || stock < 0) {
      shared.mostrarNotificacion('Completa nombre, precio y stock', 'warning');
      return;
    }

    try {
      await window.api.crearProducto({ nombre, precio, stock });
      limpiarFormularioNuevo();
      modalNuevoProducto.style.display = 'none';
      shared.mostrarNotificacion('Producto agregado', 'success');
      await cargarProductos();
      await actualizarWidgetVentasHoy();
      document.dispatchEvent(new CustomEvent('stock:updated'));
    } catch (error) {
      console.error(error);
      shared.mostrarNotificacion('No se pudo agregar el producto', 'error');
    }
  }

  async function guardarEdicionProducto() {
    const nombre = inputEditarNombre.value.trim();
    const precio = Number(inputEditarPrecio.value);
    const stockBase = Number(inputEditarStock.value);
    const sumaStock = Number(inputEditarSumarStock.value || 0);

    if (!nombre || Number.isNaN(precio) || Number.isNaN(stockBase) || Number.isNaN(sumaStock) || precio < 0 || stockBase < 0 || sumaStock < 0) {
      shared.mostrarNotificacion('Completa los datos del producto', 'warning');
      return;
    }

    try {
      await window.api.actualizarProducto(productoSeleccionadoId, {
        nombre,
        precio,
        stock: Math.max(0, stockBase + sumaStock),
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
      message: 'Eliminar este producto?',
      onConfirm: async () => {
        await window.api.eliminarProducto(productoSeleccionadoId);
        modalEditarProducto.style.display = 'none';
        shared.mostrarNotificacion('Producto eliminado', 'success');
        await cargarProductos();
        document.dispatchEvent(new CustomEvent('stock:updated'));
      },
    });

    if (!confirmado) {
      shared.mostrarNotificacion('Eliminacion cancelada', 'warning');
    }
  }

  async function init() {
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
    document.addEventListener('product:sell', event => abrirVentaProducto(event.detail?.id));
    document.addEventListener('stock:updated', cargarProductos);
    locationTabs.forEach(button => button.addEventListener('click', () => {
      const location = button.dataset.productLocation;
      locationTabs.forEach(item => item.classList.toggle('is-active', item === button));
      locationPanels.forEach(panel => panel.classList.toggle('is-active', panel.dataset.productLocationPanel === location));
      if (location === 'local2') document.dispatchEvent(new CustomEvent('stock:show'));
    }));

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
