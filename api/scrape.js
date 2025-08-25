import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Fetch HTML
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);

    let result = {};

    if (url.includes("amazon")) {
      result.title = $("#productTitle").text().trim();
      result.price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim();
    } else if (url.includes("flipkart")) {
      result.title = $("span.B_NuCI").text().trim();
      result.price = $("div._30jeq3._16Jk6d").first().text().trim();
    } else {
      result.title = $("title").text().trim();
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
}
