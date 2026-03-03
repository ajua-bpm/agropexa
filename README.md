# AGROPEXA MX — Sistema de Gestión
## agropexa.agroajua.com

Sistema de gestión comercial para Agropexa México.
Empresa hermana de Agroindustria Ajúa (Guatemala).

---

## 📁 Estructura del Repositorio

```
agropexa-repo/
├── agropexa.html        ← Página principal (punto de entrada)
├── manifest.json        ← PWA manifest
├── css/
│   └── agropexa.css     ← Estilos
├── js/
│   └── agropexa.js      ← Lógica de la aplicación
└── icons/
    ├── icon-192.png     ← Icono PWA (generar con herramienta online)
    └── icon-512.png     ← Icono PWA grande
```

---

## 🚀 Deploy en agropexa.agroajua.com

### Opción A — GitHub Pages (recomendado)
1. Crear repositorio `agropexa` en GitHub
2. Subir todos los archivos
3. Ir a Settings → Pages → Branch: main → Folder: / (root)
4. Configurar dominio personalizado: `agropexa.agroajua.com`
5. En tu proveedor DNS añadir CNAME: `agropexa → tu-usuario.github.io`

### Opción B — Hosting directo
1. Subir todos los archivos a tu servidor web
2. Apuntar `agropexa.agroajua.com` a esa carpeta

---

## 🔥 Configurar Firebase (base de datos en la nube)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un proyecto nuevo: `agropexa-mx`
3. Activa **Firestore Database** → Producción
4. En la app, ve a **⚙️ Configuración → Firebase**
5. Pega las credenciales del proyecto

### Reglas de seguridad Firestore (pega esto en Firestore → Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /agropexa_mx/{document=**} {
      allow read, write: if true;
    }
  }
}
```
> **Nota:** Para producción real, configura autenticación Firebase Auth y restricciones por usuario.

---

## 🔐 Usuarios por Defecto

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin` | Administrador |

> ⚠️ **Cambia la contraseña del admin** en la sección de Usuarios después del primer ingreso.

---

## 📦 Módulos del Sistema

| Módulo | Descripción |
|--------|-------------|
| 🏠 Dashboard | Resumen operativo del mes |
| 📋 Cotizaciones | Registro y seguimiento de ofertas |
| 💰 Ventas & Cobros | Control de ventas, créditos y pagos |
| 📅 Gastos Diarios | Gastos operativos del día a día |
| 🏢 Gastos Generales | Nómina, renta, impuestos, etc. |
| 🌽 Productos & Precios | Catálogo con costos y márgenes |
| 👥 Usuarios | Gestión de accesos |
| ⚙️ Configuración | Firebase, empresa, respaldos |

---

## 💾 Exportaciones CSV disponibles

- Cotizaciones (fecha, cliente, tipo, precios, márgenes, estado)
- Ventas (fecha, cliente, total, cobrado, saldo, estado)
- Gastos Diarios (fecha, categoría, monto)
- Gastos Generales (fecha, categoría, período, monto)
- Productos & Precios (nombre, costo, precio, margen, exportación)
- Backup completo en JSON

---

## 🖼️ Generar Iconos PWA

Usa [favicon.io](https://favicon.io) o [realfavicongenerator.net](https://realfavicongenerator.net)
para generar los iconos 192x192 y 512x512 con el logo de Agropexa y coloca los archivos en la carpeta `icons/`.

---

## 🔗 Relación con AgroAjúa

- **Agropexa MX** exporta producto a Guatemala
- **Agroindustria Ajúa** (Guatemala) lo recibe y distribuye
- Las cotizaciones de tipo "Exportación Guatemala" aparecen etiquetadas especialmente
- Ambos sistemas usan Firebase como backend (proyectos separados)

---

*Desarrollado para el ecosistema AgroAjúa · 2025*
