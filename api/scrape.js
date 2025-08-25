// api/scrape.js
const cheerio = require("cheerio");

// Allow all CORS
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// --- helpers ---
function normalizeMoney(raw) {
  if (!raw) return { price: null, currency: null };
  const compact = raw.replace(/\s+/g, " ").trim();
  let currencyMatch = compact.match(/[₹$€£]|USD|EUR|INR|GBP/i);
  let currency = currencyMatch ? currencyMatch[0].toUpperCase() : null;
  if (currency === "$") currency = "USD";
  if (currency === "₹") currency = "INR";
  if (currency === "€") currency = "EUR";
  if (currency === "£") currency = "GBP";
  let numMatch = compact.replace(/[^0-9.,]/g, "");
  numMatch = numMatch.replace(/,/g, "");
  const price = numMatch ? Number(numMatch) : null;
  return { price: Number.isFinite(price) ? price : null, currency };
}

function siteFromUrl(u) {
  const { hostname } = new URL(u);
  return hostname.replace(/^www\./, "");
}

function parseJsonLdProduct($) {
  const out = {};
  const scripts = $('script[type="application/ld+json"]');
  scripts.each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const productNode =
          node["@type"] === "Product"
            ? node
            : node["@graph"]?.find((n) => n["@type"] === "Product");
        if (productNode) {
          out.title = productNode.name || out.title;
          const offer = Array.isArray(productNode.offers)
            ? productNode.offers[0]
            : productNode.offers;
          if (offer) {
            if (offer.price) out.price = Number(offer.price);
            if (offer.priceCurrency) out.currency = offer.priceCurrency;
            out.availability = offer.availability || out.availability;
          }
          if (productNode.image) {
            out.images = Array.isArray(productNode.image)
              ? productNode.image
              : [productNode.image];
          }
          out.description = productNode.description || out.description;
          out.brand =
            typeof productNode.brand === "string"
              ? productNode.brand
              : productNode.brand?.name || out.brand;
        }
      }
    } catch {}
  });
  return out;
}

function parseAmazon($) {
  const title =
    $("#productTitle").text().trim() || $("#title").text().trim();
  const priceText =
    $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text().trim() ||
    $("#priceblock_ourprice").text().trim() ||
    $("#priceblock_dealprice").text().trim();
  const { price, currency } = normalizeMoney(priceText);
  const image =
    $("#imgTagWrapperId img").attr("src") || $("#landingImage").attr("src");
  const availability = $("#availability span").text().trim();
  return { title, price, currency, images: image ? [image] : [], availability };
}

function parseFlipkart($) {
  const title = $("span.B_NuCI").text().trim();
  const priceText =
    $("div._30jeq3._16Jk6d").first().text().trim() ||
    $("div._25b18c ._30jeq3").first().text().trim();
  const { price, currency } = normalizeMoney(priceText);
  const image =
    $("._396cs4._2amPTt._3qGmMb").attr("src") ||
    $("img[loading][src]").first().attr("src");
  const availability = $("._16FRp0").text().trim();
  return { title, price, currency, images: image ? [image] : [], availability };
}

function parseGeneric($) {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim();
  const priceText =
    $('meta[property="product:price:amount"]').attr("content") ||
    $("[itemprop=price]").attr("content") ||
    $("[class*='price']").first().text().trim();
  const { price, currency } = normalizeMoney(priceText);
  const image =
    $('meta[property="og:image"]').attr("content") || $("img").first().attr("src");
  return { title, price, currency, images: image ? [image] : [] };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error("Upstream " + res.status);
  const text = await res.text();
  if (/Robot Check|captcha/i.test(text)) throw new Error("Blocked by bot protection");
  return text;
}

// --- Vercel handler ---
module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "Missing ?url" });

    const site = siteFromUrl(url);
    const htmlText = await fetchHtml(url);
    const $ = cheerio.load(htmlText);

    let product = parseJsonLdProduct($);
    if (/amazon\./i.test(site)) {
      product = { ...product, ...parseAmazon($) };
    } else if (/flipkart\\.com$/i.test(site)) {
      product = { ...product, ...parseFlipkart($) };
    } else {
      product = { ...product, ...parseGeneric($) };
    }

    return res.status(200).json({
      url,
      site,
      title: product.title,
      price: product.price || null,
      currency: product.currency || null,
      images: product.images || [],
      availability: product.availability,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Scrape failed" });
  }
};
