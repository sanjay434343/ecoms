import fetch from "node-fetch";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Please provide ?url=" });
    }

    // Fake browser headers (Amazon blocks default requests)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let title = $("title").first().text() || "N/A";
    let price =
      $("#priceblock_ourprice").text() ||
      $("#priceblock_dealprice").text() ||
      $(".a-price .a-offscreen").first().text() ||
      $("._30jeq3").first().text() || // Flipkart
      "Not Found";

    res.json({ url, title, price });
  } catch (err) {
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
}
