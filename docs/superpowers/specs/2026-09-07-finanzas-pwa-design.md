# Finanzas personales — PWA estilo iOS

Fecha: 2026-09-07
Estado: aprobado por el usuario en brainstorming, pendiente de plan de implementación.

## 1. Objetivo

App personal para registrar cada mes lo que se ingresa, lo que se gasta y lo que se ahorra,
repartido entre varias cuentas (banco principal, cuenta de ahorro, Trade Republic efectivo,
Trade Republic cartera, Bitcoin), con transferencias entre cuentas, interés mensual automático
en Trade Republic, gastos por categoría y una pestaña de estadísticas con gráficas.

Usuario único, idioma castellano, moneda euro, uso principal en iPhone.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | Web app instalable (PWA), añadida a pantalla de inicio desde Safari. Sin App Store, sin Mac. |
| Datos | Solo en el dispositivo (localStorage). Exportar/importar copia JSON manual. |
| Hosting | GitHub Pages desde la rama principal. |
| Stack | HTML + CSS + JavaScript (ES modules). Sin Node, sin frameworks, sin compilación. Gráficas en SVG dibujado a mano. |
| "La cartera" | Cartera de inversión de Trade Republic (acciones/ETF), cuenta separada del efectivo de Trade Republic. |
| Bitcoin | Valor en euros introducido a mano. Sin consulta de precio. |
| Interés Trade Republic | Calculado automáticamente cada mes a partir del % anual configurado. Editable después. |
| Ahorro del mes | Suma neta de transferencias desde cuentas tipo banco hacia cuentas tipo ahorro, inversión o cripto. |
| Recurrentes | Sí. Ingresos y gastos que se registran solos en su día del mes. |
| Estilo | Claro y oscuro automático según el sistema. Acento azul iOS. |

## 3. Pantallas

Barra de pestañas inferior con cuatro pestañas. Todas las pantallas respetan las zonas
seguras del iPhone (`env(safe-area-inset-*)`).

### 3.1 Inicio
- Patrimonio total en grande.
- Resumen del mes actual: tres anillos circulares (estilo Actividad de iOS) para Ingresos,
  Gastos y Ahorrado. El anillo de ingresos se muestra completo si hay ingresos; el de gastos
  y el de ahorro se rellenan en proporción a los ingresos del mes (gastos/ingresos y
  ahorro/ingresos, con tope en 100 %). Si no hay ingresos, gastos y ahorro se muestran al
  100 % si son mayores que cero.
- Tarjetas de cuentas con nombre, icono, color y saldo actual.
- Botón "+" flotante que abre la hoja de nuevo movimiento.

### 3.2 Movimientos
- Selector de mes (flechas y nombre del mes).
- Lista agrupada por día. Cada fila: icono circular de color de la categoría (o icono de
  transferencia), nombre de categoría o cuentas implicadas, nota, importe (rojo gasto,
  verde ingreso, neutro transferencia).
- Etiqueta pequeña en movimientos de origen "recurrente" o "interés".
- Tocar abre la hoja de edición. Deslizar a la izquierda muestra botón Borrar.

### 3.3 Estadísticas
- Selector de mes compartido por las gráficas mensuales.
- Donut de gasto por categoría del mes con total en el centro y leyenda tocable.
- Barras de los últimos 12 meses: ingresos, gastos y ahorro por mes.
- Línea de evolución del patrimonio total al cierre de cada mes.
- Al tocar una categoría en la leyenda del donut se muestra su evolución mensual (12 meses)
  con la media como línea discontinua.

### 3.4 Ajustes
- Cuentas: lista, crear, editar (nombre, tipo, color, icono, saldo inicial, % anual si
  aplica), borrar (bloqueado si tiene movimientos o valoraciones).
- Categorías: lista, crear, editar (nombre, color, icono), borrar (si está en uso, se
  ofrece reasignar sus movimientos a "Otros"). Las de sistema no se borran.
- Recurrentes: lista, crear, editar, borrar.
- Copia de seguridad: Exportar (JSON) e Importar (JSON, con confirmación).
- Información: versión de la app.

### 3.5 Hoja de movimiento (nuevo / editar)
Modal que sube desde abajo, con asa superior y botones Cancelar / Guardar.
- Segmented control: Gasto | Ingreso | Transferencia.
- Importe con teclado numérico (`inputmode="decimal"`), tipografía grande.
- Cuenta origen. En transferencia, además cuenta destino.
- Categoría: rejilla de iconos circulares (solo en gasto e ingreso).
- Fecha (por defecto hoy). Nota opcional.
- En edición: botón Borrar en rojo al pie.

### 3.6 Actualizar valoración (Bitcoin, cartera TR)
Al tocar una cuenta de valor manual en Inicio se abre una hoja con el valor actual y un
campo para el nuevo valor, más la fecha. Guarda una entrada en el historial de valoraciones.

## 4. Modelo de datos

Un único objeto JSON en `localStorage` bajo la clave `finanzas.v1`. Importes en céntimos
(enteros). Fechas como `YYYY-MM-DD`. Ids como cadenas generadas con `crypto.randomUUID()`.

```
{
  schemaVersion: 1,
  accounts: [ {
    id, name, kind: "bank"|"savings"|"investment"|"crypto",
    valuation: "ledger"|"manual",      // ledger: saldo por movimientos; manual: por valoraciones
    initialBalance,                    // solo ledger
    annualRate,                        // % anual, opcional, solo ledger (Trade Republic efectivo)
    color, icon, order
  } ],
  valuations: [ { id, accountId, date, value } ],   // solo cuentas manual
  categories: [ { id, name, color, icon, system: bool, order } ],
  transactions: [ {
    id, type: "expense"|"income"|"transfer",
    amount, date,
    accountId,                          // origen
    toAccountId,                        // solo transfer
    categoryId,                         // solo expense/income
    note,
    source: "manual"|"recurring"|"interest",
    recurringId                         // si source = recurring
  } ],
  recurring: [ {
    id, type: "expense"|"income", amount, accountId, categoryId, note,
    dayOfMonth (1..28), active: bool, lastPosted: "YYYY-MM"
  } ],
  meta: { interestLastPosted: { [accountId]: "YYYY-MM" } }
}
```

Datos iniciales (primer arranque):
- Cuentas: Banco principal (bank, ledger), Cuenta de ahorro (savings, ledger),
  Trade Republic efectivo (savings, ledger, annualRate editable), Trade Republic cartera
  (investment, manual), Bitcoin (crypto, manual).
- Categorías: Ocio, Tabaco, Gasto mensual, Comida, Transporte, Compras, Salud,
  Suscripciones, Otros, y las de sistema Intereses y Nómina (no borrables, editables).

## 5. Lógica de negocio

Todas las funciones de cálculo son puras (reciben el estado y devuelven valores), sin
acceso al DOM ni a localStorage.

- **Saldo cuenta ledger** = initialBalance + ingresos + transferencias recibidas − gastos −
  transferencias enviadas, hasta la fecha indicada (por defecto hoy).
- **Saldo cuenta manual** = valor de la última valoración con fecha ≤ fecha indicada, o 0.
- **Patrimonio** = suma de saldos de todas las cuentas.
- **Resumen mensual** (para un `YYYY-MM`):
  - ingresos = suma de `income` del mes.
  - gastos = suma de `expense` del mes.
  - ahorro = suma de transferencias del mes con origen kind `bank` y destino kind
    `savings|investment|crypto`, menos las del sentido contrario.
- **Gasto por categoría** del mes: suma de `expense` agrupada por `categoryId`.
- **Serie 12 meses**: resumen mensual de los 12 meses que terminan en el mes seleccionado.
- **Serie patrimonio**: patrimonio al último día de cada mes desde el primer movimiento o
  valoración hasta el mes actual.
- **Interés mensual**: al arrancar, para cada cuenta con `annualRate`, por cada mes `M`
  entre `interestLastPosted` (exclusivo) y el mes actual (inclusivo), en orden cronológico:
  importe = redondeo(saldo al último día del mes anterior a M × annualRate / 100 / 12);
  se crea `income` con `source: "interest"`, categoría Intereses, fecha día 1 de `M`.
  Si el importe es 0 no se crea movimiento pero sí se avanza `interestLastPosted`.
  En el primer arranque `interestLastPosted` se fija al mes actual (no se generan atrasos).
- **Recurrentes**: al arrancar, por cada recurrente activo y por cada mes entre
  `lastPosted` (exclusivo) y el mes actual (inclusivo): si el día `dayOfMonth` de ese mes
  ya ha llegado, se crea el movimiento con `source: "recurring"` y se actualiza
  `lastPosted`. Un recurrente recién creado tiene `lastPosted` = mes anterior si su día
  aún no ha llegado este mes, o mes actual si ya pasó (y en ese caso pregunta si registrar
  el de este mes).
- **Validaciones**: importe > 0; transferencia con origen ≠ destino; borrar cuenta solo si
  no tiene movimientos ni valoraciones; borrar categoría en uso exige reasignar a Otros;
  categorías de sistema no se borran.

## 6. Gráficas

SVG generado en JS, sin librerías. Colores desde variables CSS para que sigan el tema.
- Donut: arcos por categoría, total en el centro, leyenda con color, nombre, importe y %.
  Tocar segmento o leyenda resalta y muestra detalle.
- Barras 12 meses: tres barras por mes (ingresos, gastos, ahorro). Tocar un mes muestra
  las tres cifras.
- Línea patrimonio: polilínea con área suave bajo la curva, etiquetas de primer y último valor.
- Evolución de categoría: barras mensuales + línea discontinua de media.
- Meses sin datos se dibujan a cero, sin romper la escala.

## 7. Persistencia, copia y PWA

- Guardado automático en localStorage tras cada cambio de estado.
- Al cargar: si no hay datos, se crean los iniciales; si el JSON no se puede parsear, se
  muestra aviso y se ofrece importar copia (los datos corruptos se conservan bajo otra clave
  para no perderlos).
- Exportar: archivo `finanzas-YYYY-MM-DD.json`. En iOS se usa Web Share API con archivo
  (hoja de compartir); si no está disponible, descarga directa.
- Importar: `<input type="file">`, validación de `schemaVersion`, confirmación antes de
  reemplazar.
- `manifest.webmanifest`: nombre "Finanzas", `display: standalone`, iconos 192/512, color
  de tema. `apple-touch-icon` y `apple-mobile-web-app-capable` en el HTML.
- Service worker con estrategia cache-first para todos los archivos estáticos y versión en
  el nombre de la caché para forzar actualización al publicar.
- Formato de moneda con `Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })`.

## 8. Estructura de archivos

```
app_banco/
  index.html
  manifest.webmanifest
  sw.js
  icons/
  css/
    base.css          # variables de diseño (colores claro/oscuro, radios, tipografía), reset
    components.css    # tarjetas, listas, segmented control, hoja modal, tab bar, anillos
  js/
    app.js            # arranque, enrutado de pestañas, montaje de vistas
    store.js          # carga/guarda estado, datos iniciales, migraciones, exportar/importar
    model.js          # cálculos puros: saldos, resúmenes, series, interés, recurrentes
    format.js         # moneda, fechas, meses
    charts.js         # donut, barras, línea (SVG)
    views/
      home.js
      transactions.js
      stats.js
      settings.js
      sheet-transaction.js
      sheet-valuation.js
  tests/
    tests.html        # runner en navegador, sin dependencias
    model.test.js
    format.test.js
  docs/superpowers/specs/
```

## 9. Pruebas

- `model.js` y `format.js` se prueban con un mini-runner propio en `tests/tests.html`
  (abrir en el navegador, ver verde/rojo). Casos mínimos: saldos con transferencias,
  resumen mensual y ahorro neto, interés de un mes y de varios meses atrasados, recurrentes
  con día pasado y futuro, series con meses vacíos, formato de moneda.
- Vistas y PWA: verificación manual en Safari iOS (instalación, modo sin conexión, tema
  claro/oscuro, zonas seguras).

## 10. Fuera de alcance (por ahora)

Sincronización en la nube, varias monedas, precio automático de Bitcoin, presupuestos por
categoría, notificaciones, adjuntar tickets, varios usuarios.
