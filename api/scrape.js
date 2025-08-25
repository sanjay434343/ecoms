// api/scrape.js
import fetch from "node-fetch";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing url query parameter" });
    }

    // Fake headers (to bypass blocks)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let data = { url };

    // --- Amazon ---
    if (url.includes("amazon")) {
      data.name = $("#productTitle").text().trim();
      data.price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim();
    }

    // --- Flipkart ---
    else if (url.includes("flipkart")) {
      data.name = $("span.B_NuCI").text().trim();
      data.price = $("div._30jeq3._16Jk6d").text().trim();
    }

    // --- Generic fallback ---
    else {
      data.name = $("h1").first().text().trim();
      data.price =
        $("span.price").first().text().trim() ||
        $("div.price").first().text().trim();
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Scraper error:", err);
    return res.status(500).json({ error: "Scraping failed", details: err.message });
  }
}
