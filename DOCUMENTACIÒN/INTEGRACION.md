# Integracion y mantenimiento

## Instalacion

1. Respaldar la version instalada.
2. Publicar el contenido de `web/` en `/puntos-encuentro/`.
3. Habilitar HTTPS. Servir `.js` como JavaScript, `.css` como CSS y `.pdf` como PDF.
4. Abrir `/puntos-encuentro/` y ejecutar la comprobacion de aceptacion.
5. Agregar un enlace desde el menu de la web corporativa.

```html
<a href="/puntos-encuentro/">Puntos de encuentro</a>
```

Mantener la barra final de la subcarpeta. Las rutas son relativas.
No se requiere Node.js, Python, PHP, cuentas ni claves para ejecutar esta entrega.
Node.js solo se utiliza para las pruebas.

## Insercion dentro de una pagina

El modulo usa estilos globales, identificadores HTML y fragmentos de URL propios.
No pegar su HTML y sus scripts directamente en la plantilla del portal.
Para mostrarlo dentro de otra pagina, usar un iframe del mismo dominio:

```html
<iframe
  src="/puntos-encuentro/"
  title="Puntos de encuentro SMCV"
  allow="geolocation"
  class="mapa-encuentro"
></iframe>
```

En la hoja de estilos del portal:

```css
.mapa-encuentro {
  display: block;
  width: 100%;
  height: 85dvh;
  min-height: 480px;
  border: 0;
}
```

El enlace independiente ofrece mas espacio en celulares. El iframe mantiene
separados los estilos y la navegacion del modulo y del portal.
No agregar `sandbox` sin probar GPS, llamadas, PDF y enlaces externos.

Si el modulo esta en otro dominio, sistemas debe permitir ese origen en
`Permissions-Policy: geolocation`, en `frame-src` del portal y en
`frame-ancestors` del modulo. El atributo `allow` no anula una prohibicion
del servidor. Ambos sitios deben usar HTTPS.

## Servidor y red

`servidor/nginx.conf.example` contiene una configuracion de referencia para
una subcarpeta en el mismo dominio. Adaptar la ruta fisica y comprobar
la configuracion heredada. No reemplaza la configuracion del portal.

El navegador solicita imagenes a:

| Servicio | Dominio | Uso |
|---|---|---|
| Esri World Imagery | server.arcgisonline.com | Fondo satelital |
| OpenStreetMap | tile.openstreetmap.org | Fondo cartografico |

Google Maps se abre solo al pulsar el enlace de una ficha. El enlace de
atribucion de Esri abre `goto.arcgisonline.com`. El de OpenStreetMap abre
`www.openstreetmap.org`.

Mantener las atribuciones visibles. Confirmar con el proveedor las condiciones
de uso, atribucion y capacidad antes del despliegue corporativo. No se ha
contratado disponibilidad ni soporte de estos servicios. No descargar teselas
masivamente ni implementar un modo offline sobre los servidores publicos.

## Archivos

| Archivo | Funcion |
|---|---|
| index.html | Pantallas, botones y telefonos |
| styles.css | Colores, medidas y distribucion adaptable |
| points.js | Catalogo de puntos, coordenadas y areas |
| geo.js | Distancia y validacion GPS |
| app.js | Mapa, seleccion, fichas y navegacion |
| maps/ | Imagenes de las fichas |
| assets/ | Logo |
| vendor/ | Leaflet 1.9.4 y Lucide 0.468.0, con licencias |
| anexo-05.pdf | Documento de referencia |

Las bibliotecas estan incluidas localmente. Sus versiones se conservaron;
esta revision no constituye una auditoria de vulnerabilidades de terceros.

## Actualizar puntos

Editar el registro correspondiente en `points.js`:

```js
{
  id: "15A",
  reference: "Descripcion del punto",
  areas: ["Area uno", "Area dos"],
  lat: -16.564972222222222,
  lng: -71.59330555555555,
  latDms: "16°33'53.90\"S",
  lngDms: "71°35'35.90\"O",
  page: 21,
  image: "maps/pe-15a.jpg"
}
```

El ejemplo ilustra el formato; no reemplaza la validacion del documento vigente.
Mantener identificadores unicos. Actualizar tanto coordenadas decimales como
grados/minutos/segundos. Sur y oeste se representan con numeros negativos.
Las imagenes deben estar en `maps/`, con nombres sin espacios y extension
jpg, jpeg, png o webp. Respetar mayusculas y minusculas del servidor.

Al cambiar el anexo, reemplazar el PDF y las imagenes afectadas, y actualizar
paginas, fecha y descripcion en `index.html`. El contador de la lista se calcula
automaticamente. La descripcion de la pagina contiene el numero de puntos y
debe actualizarse si cambia. Los telefonos y anexos se editan en `index.html`.
El anexo 2222 se marca manualmente tras llamar a la central.

Publicar los archivos juntos y purgar la cache del portal si corresponde.
Conservar el paquete anterior para poder restaurarlo completo.

## Ubicacion

El calculo usa Haversine y ordena por distancia en linea recta.
No contempla caminos, barreras, desniveles ni condiciones de emergencia.
Los umbrales de `geo.js` son criterios de software, pendientes de aprobacion
operativa: lectura de hasta 60 segundos, precision de hasta 100 metros y
seleccion automatica solo a 5 km o menos del punto mas cercano.

Cuando el margen GPS permite mas de un candidato, se muestra un aviso.
La ubicacion depende del permiso y de la disponibilidad del dispositivo.
El navegador puede volver a pedir permiso o suspender GPS en segundo plano;
el codigo no puede garantizar permiso permanente ni seguimiento continuo.

La aplicacion no guarda ubicaciones ni dispone de un servidor receptor.
Mantiene la ultima lectura en memoria mientras la pagina esta abierta.
Los proveedores de mapas reciben la IP y las solicitudes de teselas del area
visible, que pueden revelar la zona consultada. El servidor corporativo
puede registrar accesos segun su propia configuracion.

## Comprobacion de aceptacion

- Abrir el modulo por HTTPS desde el menu corporativo y desde el iframe, si se usa.
- Probar iPhone/Safari, Android/Chrome y los navegadores de escritorio de la empresa.
- Girar el telefono y comprobar franja, mapa, fichas y lista.
- Permitir y denegar GPS; volver a la pagina despues de bloquear el telefono.
- Verificar coordenadas, areas, fotos, telefonos y PDF con el responsable del anexo.
- Comprobar ambos fondos con la red y los filtros de la empresa.
- Probar enlaces de llamada sin efectuar llamadas de emergencia de prueba.
- Aprobar permisos, uso de imagenes, datos publicados y condiciones de los proveedores.

## Pruebas del paquete

Desde esta carpeta, con Node.js:

```sh
node --test tests/datos.test.cjs
```

La prueba de interfaz requiere Playwright y Chromium disponibles:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/interfaz.cjs
```

No instalar herramientas de prueba en el servidor de produccion.
La prueba de interfaz usa GPS y teselas simulados. No comprueba cobertura GPS
real, condiciones de red de la mina ni vigencia del anexo.

## Referencias

- Geolocalizacion en iframe: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation
- Politica de teselas: https://operations.osmfoundation.org/policies/tiles/
- Servicio satelital: https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
- Leaflet 1.9.4: https://github.com/Leaflet/Leaflet/tree/v1.9.4
- Lucide 0.468.0: https://github.com/lucide-icons/lucide/tree/0.468.0
