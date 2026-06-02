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
  const inputVentaMonto = document.getElementById('producto-venta-monto');
  const inputVentaObservacion = document.getElementById('producto-venta-observacion');
  const guardarVentaBtn = document.getElementById('guardar-venta-producto');

  let productos = [];
  let productoSeleccionadoId = null;
  let productoVentaId = null;

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
    inputVentaMonto.value = '';
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
    productos = await window.api.obtenerProductos();
    renderizarProductos();
  }

  function renderizarProductos() {
    cuerpoProductos.innerHTML = '';
    sinProductos.style.display = productos.length === 0 ? 'block' : 'none';

    productos.forEach(producto => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.precio}</td>
        <td>${producto.stock}</td>
        <td>
          <div class="table-action-group">
            <button class="table-action-button primary" data-vender-producto="${producto.id}">Vender 1</button>
            <button class="table-action-button" data-editar-producto="${producto.id}">Editar</button>
          </div>
        </td>
      `;
      cuerpoProductos.appendChild(tr);
    });

    document.querySelectorAll('[data-vender-producto]').forEach(btn => {
      btn.addEventListener('click', () => abrirVentaProducto(btn.getAttribute('data-vender-producto')));
    });

    document.querySelectorAll('[data-editar-producto]').forEach(btn => {
      btn.addEventListener('click', () => abrirEdicionProducto(btn.getAttribute('data-editar-producto')));
    });
  }

  async function renderizarVentasDashboard(fecha = dashboardFecha?.value || hoyYYYYMMDD()) {
    if (!tablaDashboardVentas || !dashboardSinVentas) return;

    const ventasDelDia = await window.api.obtenerVentasProductos(fecha);
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
  }

  function abrirVentaProducto(id) {
    const producto = productos.find(item => String(item.id) === String(id));
    if (!producto) return;

    productoVentaId = producto.id;
    limpiarFormularioVenta();
    inputVentaNombre.value = producto.nombre;
    inputVentaMonto.value = String(producto.precio);
    modalVenderProducto.style.display = 'flex';
  }

  async function venderProductoSeleccionado() {
    if (!productoVentaId) return;

    const pago = obtenerPagoVenta();
    if (Number.isNaN(pago.monto) || pago.monto <= 0) {
      shared.mostrarNotificacion('Ingresa un monto valido', 'warning');
      return;
    }

    try {
      await window.api.venderProducto({ id: Number(productoVentaId), payment: pago });
      modalVenderProducto.style.display = 'none';
      shared.mostrarNotificacion('Venta registrada', 'success');
      await cargarProductos();
      await renderizarVentasDashboard();
      await actualizarWidgetVentasHoy();
      document.dispatchEvent(new CustomEvent('cash:updated'));
    } catch (error) {
      console.error(error);
      shared.mostrarNotificacion(
        error?.message === 'No hay stock disponible' ? 'No hay stock disponible' : (error?.message || 'No se pudo registrar la venta'),
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
    guardarProductoBtn?.addEventListener('click', crearProducto);
    guardarEdicionBtn?.addEventListener('click', guardarEdicionProducto);
    eliminarProductoBtn?.addEventListener('click', eliminarProducto);
    guardarVentaBtn?.addEventListener('click', venderProductoSeleccionado);

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
