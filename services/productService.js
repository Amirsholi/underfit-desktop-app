function createProductService({ db, productRepository, productSaleRepository, cashService }) {
  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  function nowLocalParts() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return {
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      ts: d.toISOString(),
    };
  }

  function normalizeProductInput({ nombre, precio, stock }) {
    const normalized = {
      nombre: String(nombre || '').trim(),
      precio: Number(precio),
      stock: Number(stock),
    };

    if (!normalized.nombre) {
      throw new Error('Nombre obligatorio');
    }
    if (!Number.isFinite(normalized.precio) || normalized.precio < 0) {
      throw new Error('Precio invalido');
    }
    if (!Number.isFinite(normalized.stock) || normalized.stock < 0) {
      throw new Error('Stock invalido');
    }

    return normalized;
  }

  function normalizeProductId(id) {
    const normalizedId = Number(id);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      throw new Error('Producto invalido');
    }
    return normalizedId;
  }

  async function listProducts() {
    return productRepository.findAll();
  }

  async function createProduct(input) {
    const product = normalizeProductInput(input);
    return productRepository.create(product);
  }

  async function updateProduct(id, input) {
    const productId = normalizeProductId(id);
    const product = normalizeProductInput(input);
    const result = await productRepository.update(productId, product);
    return { ...result, product: await productRepository.findById(productId) };
  }

  async function deleteProduct(id) {
    return productRepository.remove(normalizeProductId(id));
  }

  async function sellOneProduct(payload) {
    const productId = normalizeProductId(payload?.id ?? payload);
    const quantity = Math.max(1, Number.parseInt(payload?.quantity ?? 1, 10));

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Cantidad invalida');
    }

    await run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const product = await productRepository.findById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }
      if (Number(product.stock) < quantity) {
        throw new Error('No hay stock suficiente');
      }

      const saleTotal = Number(product.precio) * quantity;

      const payment = cashService.normalizePaymentDetails(
        payload?.payment || { monto: saleTotal, formaPago: 'efectivo', montoRecibido: saleTotal },
        saleTotal
      );

      const newStock = Number(product.stock) - quantity;
      await productRepository.update(productId, {
        nombre: product.nombre,
        precio: Number(product.precio),
        stock: newStock,
      });

      const now = nowLocalParts();
      const sale = await productSaleRepository.create({
        productoId: productId,
        nombre: product.nombre,
        cantidad: quantity,
        total: saleTotal,
        fecha: now.fecha,
        hora: now.hora,
        ts: now.ts,
        formaPago: payment.formaPago,
        montoRecibido: payment.montoRecibido,
        cambio: payment.cambio,
        observacion: payment.observacion,
      });

      const movimientoCaja = await cashService.registerMovement({
        tipoIngreso: 'venta_producto',
        descripcion: product.nombre,
        payment,
        producto: {
          id: product.id,
          nombre: product.nombre,
        },
        cantidad: quantity,
        referencia: { tabla: 'ventas_productos', id: sale.id },
      });

      await run('COMMIT');

      return {
        success: true,
        product: {
          ...product,
          stock: newStock,
        },
        sale,
        movimientoCaja,
      };
    } catch (error) {
      try {
        await run('ROLLBACK');
      } catch (_) {}
      throw error;
    }
  }

  async function listSalesByDate(fecha) {
    return productSaleRepository.findByDate(fecha || nowLocalParts().fecha);
  }

  async function getSalesTotalByDate(fecha) {
    return productSaleRepository.totalByDate(fecha || nowLocalParts().fecha);
  }

  return {
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    sellOneProduct,
    listSalesByDate,
    getSalesTotalByDate,
  };
}

module.exports = { createProductService };
