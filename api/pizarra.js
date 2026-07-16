// api/pizarra.js
// Función serverless de Vercel: trae los precios de pizarra de BCR desde el
// servidor (no desde el navegador del visitante), así se evita por completo el
// problema de CORS que bloquea el fetch directo desde el navegador.
// Vercel detecta automáticamente cualquier archivo .js dentro de /api como un
// endpoint propio: quedará disponible en https://tu-sitio.vercel.app/api/pizarra

const PIZARRA_URL = "https://www.cac.bcr.com.ar/es/precios-de-pizarra";

const GRANOS = [
  { key: "trigo", re: "Trigo" },
  { key: "maiz", re: "Ma[ií]z" },
  { key: "soja", re: "Soja" },
];

function parsePrecioARS(v) {
  if (!v) return 0;
  const s = String(v).trim().replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

module.exports = async function handler(req, res) {
  // Cachea la respuesta 30 minutos en el borde de Vercel para no golpear a BCR
  // en cada visita, y para que la página cargue instantáneo la mayoría de las veces.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  try {
    const r = await fetch(PIZARRA_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgroGestionBot/1.0)" },
    });
    if (!r.ok) throw new Error("BCR respondió con status " + r.status);
    const html = await r.text();
    const clean = html.replace(/\s+/g, " ");

    const dateMatch = clean.match(/Precios Pizarra del d[ií]a\s*(\d{2}\/\d{2}\/\d{4})/i);
    const fecha = dateMatch ? dateMatch[1] : null;

    const data = {};
    GRANOS.forEach((g) => {
      const re = new RegExp(
        g.re + "[\\s\\S]{0,400}?\\$\\s*([\\d.,]+)[\\s\\S]{0,250}?US\\$[^\\d]*([\\d.,]+)",
        "i"
      );
      const m = clean.match(re);
      if (m) data[g.key] = { ars: parsePrecioARS(m[1]), usd: parsePrecioARS(m[2]) };
    });

    if (Object.keys(data).length === 0) {
      throw new Error("No se pudo reconocer el formato de precios de BCR");
    }

    res.status(200).json({ ok: true, fecha, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
};
