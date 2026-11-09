# mcp-espocrm-local

Servidor MCP local para que Claude Desktop lea y gestione tu EspoCRM: busca leads, lee fichas, crea y actualiza registros y añade notas. Un solo fichero, sin dependencias, sin borrado.

Creado por [DTR](https://www.dtr.es) a partir de una integración real de WordPress, Brevo y EspoCRM.

## Qué hace

| Herramienta | Para qué |
|---|---|
| `espocrm_find` | Busca registros (texto, filtros, orden, paginación) |
| `espocrm_read` | Lee un registro completo por id |
| `espocrm_create` | Crea un registro |
| `espocrm_update` | Actualiza campos de un registro |
| `espocrm_add_note` | Añade una nota al stream de un registro |

Entidades: Lead, Account, Contact, Opportunity, Task, Meeting, Call.

**No hay herramienta de borrado, a propósito.** Si quieres borrar, hazlo tú en el CRM.

## Requisitos

- Node.js 18 o superior (`node --version`).
- Un EspoCRM accesible por HTTPS desde tu ordenador.
- Claude Desktop.

## Instalación

### 1. Crea un usuario API con permisos limitados

En EspoCRM, Administración → Roles, crea un rol (por ejemplo «API-Claude») con **borrado en «no»** para todas las entidades. Después, Administración → Usuarios API → crea un usuario con autenticación por clave API y asígnale ese rol. Copia su clave API.

El rol es tu cinturón de seguridad: aunque algo fallara en este servidor, EspoCRM no dejará borrar ni acceder a lo que el rol no permita.

### 2. Descarga este repositorio

```
git clone https://github.com/Desarrollo-Tecnologico-Rural-S-L/mcp-espocrm-local.git
```

### 3. Regístralo en Claude Desktop

Abre Claude Desktop → Configuración → Desarrollador → **Editar configuración** y añade el bloque de [`claude_desktop_config.example.json`](claude_desktop_config.example.json) con tu ruta, tu URL y tu clave. En Windows usa barras normales (`C:/Users/...`) para evitar errores con las barras invertidas.

Cierra Claude del todo (también desde la bandeja del sistema) y ábrelo de nuevo.

### 4. Comprueba que funciona

En un chat nuevo escribe: *«Busca en EspoCRM los últimos 5 leads»*. Si algo falla, Configuración → Desarrollador → tu servidor → ver registros.

## Prueba automática

```
node test/smoke.mjs
```

Levanta un EspoCRM falso y comprueba que el servidor envía bien la clave, los filtros y las actualizaciones, y que rechaza entidades no permitidas.

## Seguridad

- La clave API vive solo en tu configuración local. No la subas a ningún repositorio ni la pegues en chats.
- Usa siempre un usuario API con un rol sin borrado.
- Claude puede crear y modificar registros: revisa lo que te propone antes de aceptar acciones masivas.
- Este servidor solo funciona en local, con Claude Desktop. No expone nada a internet.

## Limitaciones

- Funciona con Claude Desktop en tu ordenador; no sirve desde la web ni el móvil.
- EspoCRM 10 incluye una extensión MCP oficial ([espocrm/ext-mcp](https://github.com/espocrm/ext-mcp)) que expone el CRM como servidor remoto. Úsala si tu versión de Claude la soporta; este proyecto es la alternativa local que funciona hoy.

## Licencia

GPL-3.0. Consulta [LICENSE](LICENSE).
