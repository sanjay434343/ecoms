import type { VercelRequest, VercelResponse } from "@vercel/node";
return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
}
const { url, html } = parsed.data;


const site = siteFromUrl(url);
const htmlText = await fetchHtml(url);
if (html === "true") return res.status(200).send(htmlText);


const $ = cheerio.load(htmlText);


// Start with structured data
let product: Partial<Product> = parseJsonLdProduct($);


// Site-specific overrides/augmentations
if (/amazon\./i.test(site)) {
product = { ...product, ...parseAmazon($) };
} else if (/flipkart\.com$/i.test(site)) {
product = { ...product, ...parseFlipkart($) };
}


// Fallback generic
if (!product.title || (!product.price && !product.currency)) {
product = { ...parseGeneric($), ...product };
}


const out: Product = {
url,
site,
title: product.title,
price: typeof product.price === "number" ? product.price : product.price ?? null,
currency: product.currency ?? null,
images: product.images || [],
rating: product.rating,
availability: product.availability,
brand: product.brand,
seller: product.seller,
description: product.description,
fetchedAt: new Date().toISOString(),
};


return res.status(200).json(out);
} catch (err: any) {
return res.status(500).json({ error: err?.message || "Scrape failed" });
}
}
