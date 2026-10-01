# Revision tecnica

Fecha: 30/09/2026.
Base: ultima version publicada del modulo SMCV, con 24 puntos.
Destino: entrega independiente para integrar en la web corporativa.

## Resultado

Codigo preparado para pruebas de integracion. Las pruebas locales indicadas
abajo finalizaron sin fallos. La aprobacion de produccion corresponde a sistemas
y al responsable operativo, una vez probado en el dominio y los dispositivos
de la empresa. No es una certificacion de seguridad ni de disponibilidad.

## Cambios

| Archivo | Cambio |
|---|---|
| app.js | Control de catalogo ausente o invalido antes de iniciar el mapa |
| app.js | Contador de puntos calculado desde el catalogo |
| app.js | Reajuste del mapa cuando cambia su contenedor |
| app.js | Apertura de fichas coherente con el diseno hasta 1100 px |
| app.js | Aviso cuando la precision GPS no distingue entre puntos cercanos |
| app.js | Sin inicio automatico del GPS antes de una accion del usuario |
| app.js | Manejo de historial y retorno del foco al cerrar fichas |
| geo.js | Validacion de identificadores, coordenadas, campos y rutas de imagen |
| index.html | Aclaracion del requisito HTTPS |
| vendor/ | Incorporacion de licencias Leaflet, Lucide y Feather |

Se conservaron puntos, areas, telefonos, fotos, PDF y diseno. No se reescribieron
las bibliotecas ni se introdujeron servicios, cuentas o bases de datos.
El paquete no modifica por si mismo la version publicada en Sites.

## Pruebas ejecutadas

Entorno: Node.js 24.19.0; Chromium Headless Shell 134.0.6998.35.

| Prueba | Resultado |
|---|---|
| Estructura del catalogo, identificadores e imagenes | Conforme |
| Coincidencia entre coordenadas decimales y DMS | Conforme |
| Haversine y seleccion del punto cercano | Conforme |
| Lecturas invalidas, antiguas y futuras | Conforme |
| Umbrales de precision y distancia | Conforme |
| Catalogo vacio, duplicados y rutas no locales | Conforme |
| Deteccion de cercania ambigua | Conforme |
| Sintaxis JavaScript y rutas del HTML | Conforme |
| Navegacion, desplegable, seleccion y cierre de fichas | Conforme |
| GPS simulado, precision insuficiente y permiso denegado | Conforme |
| Vista de 320, 393, 852, 1024 y 1440 px de ancho | Sin desborde horizontal |
| Mapa visible y espacio para referencia en esos tamanos | Conforme |
| Subcarpeta e iframe del mismo origen | Conforme |
| CSP y Permissions-Policy del ejemplo | Sin infracciones durante las pruebas |
| Errores JavaScript en los recorridos probados | Ninguno |

`tests/datos.test.cjs`: 9 pruebas aprobadas.
`tests/interfaz.cjs`: recorrido aprobado.
La prueba visual uso teselas y GPS simulados, no imagenes satelitales reales.
Se inspecciono ademas la captura de la vista horizontal.

## Pendientes de la empresa

1. Validar vigencia, coordenadas, areas, fotos y contactos contra el anexo aprobado.
2. Probar Safari/iPhone, Chrome/Android y GPS en campo. No se probaron equipos reales.
3. Aplicar los encabezados HTTP en su servidor y revisar reglas heredadas del portal.
4. Confirmar condiciones y atribucion de los proveedores de mapas. No hay SLA contratado.
5. Aprobar publicacion de la informacion, logo y documento fuente.
6. Revisar accesibilidad: el blanco sobre el naranja actual tiene contraste bajo.
   Se conservo la combinacion solicitada; no se declara conformidad WCAG AA.
7. Incorporar las bibliotecas a su control habitual de dependencias y vulnerabilidades.

El ejemplo Nginx no se ejecuto en un servidor Nginx. Sus encabezados se
probaron con un servidor local de prueba. No se hicieron pruebas de carga,
penetracion ni funcionamiento sin conexion.
