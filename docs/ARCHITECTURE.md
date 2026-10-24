# Arquitectura

La primera versión reunía Electron, JavaScript y SQLite en una PC. Incorporar tablets y dos locales requirió centralizar las operaciones. La arquitectura actual conserva el escritorio y desplaza los casos de uso compartidos a una API .NET con PostgreSQL.

![Componentes](assets/components.svg)

El componente móvil representa la base web/PWA implementada, cuya entrega completa está pendiente de validación.

## Responsabilidades

| Proyecto / carpeta | Responsabilidad |
|---|---|
| `main.js`, `preload.js`, `handlers/` | Ciclo de vida Electron e interfaz IPC |
| `services/`, `clients/` | Servicios locales, adaptadores API e instalación |
| `repositories/`, `database/` | Persistencia SQLite del modo local |
| `UnderFit.Domain` | Entidades e invariantes independientes de HTTP |
| `UnderFit.Application` | Casos de uso y abstracciones |
| `UnderFit.Contracts` | Solicitudes y respuestas |
| `UnderFit.Infrastructure` | Entity Framework Core, PostgreSQL y migraciones |
| `UnderFit.Api` | Endpoints, autenticación, tablets y medios |
| `UnderFit.Keypad` | Integración Windows para el pad |
| `tablet-app/` | Interfaz web de profesores |
| `UnderFit.Api/wwwroot/socios/` | Base web/PWA de socios |

## Flujo representativo

Al registrar una venta, la interfaz invoca el servicio correspondiente. En modo conectado, la API ejecuta el caso de uso de inventario y registra su efecto en caja. Los reportes utilizan los movimientos persistidos. Las nuevas ventas conservan nombre y cantidad del producto para que el detalle histórico no dependa del catálogo actual.

Las clases conservan su local. Las tablets consultan ambos locales; eliminar una serie respeta las ocurrencias anteriores y las restricciones sobre asistencias registradas.

## Despliegue y compromisos

El escritorio consume la API local. Tablets y clientes remotos acceden mediante HTTPS y Cloudflare Tunnel. PostgreSQL escucha en loopback. La API distingue acceso de dispositivos y sesiones de socios. Los medios son archivos y deben respaldarse junto con la base.

Conservar Electron permite mantener la interfaz y los dispositivos Windows. La API evita bases independientes por tablet, pero introduce dependencia del servidor y la conectividad. SQLite permanece para compatibilidad y migración.

No hay alta disponibilidad ni reversión automática de esquema. La API y algunos módulos de interfaz aún concentran responsabilidades que pueden separarse en futuras iteraciones.
