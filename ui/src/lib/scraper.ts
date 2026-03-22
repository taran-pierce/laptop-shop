import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const OUTPUT_DIR = path.join(process.cwd(), 'csv_output');
const CSV_FILE = path.join(OUTPUT_DIR, 'laptop_price_tracking.csv');
const CONFIG_FILE = path.join(process.cwd(), '..', 'scraper_config.json');

let SEARCH_TERMS = ["ASUS ROG Strix SCAR 18", "ASUS ROG Strix G18"];
let PRICE_TARGETS = {
  "ASUS ROG Strix SCAR 18": 2500,
  "ASUS ROG Strix G18": 2100
};

let globalLogCallback: ((msg: string) => void) | undefined;

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      SEARCH_TERMS = config.searchTerms || SEARCH_TERMS;
      PRICE_TARGETS = config.priceTargets || PRICE_TARGETS;
    } catch (e) {
      console.log(`⚠️ Failed to load config: ${e}, using defaults`);
    }
  }
}

function log(msg: string) {
  const fullMsg = `[LOG] ${msg}`;
  console.log(fullMsg);
  if (globalLogCallback) globalLogCallback(fullMsg);
}

function cleanPrice(priceStr: string): number | null {
  try {
    return parseFloat(priceStr.replace('$', '').replace(',', '').trim());
  } catch {
    return null;
  }
}

function humanScroll(page: any) {
  page.mouse.wheel(0, 1500);
  page.waitForTimeout(1000 + Math.random() * 1000);
  page.mouse.wheel(0, 1500);
  page.waitForTimeout(1000 + Math.random() * 1000);
}

function isRelevant(title: string, query?: string): boolean {
  const titleLower = title.toLowerCase();
  if (query) {
    return titleLower.includes(query.toLowerCase());
  }
  for (const term of SEARCH_TERMS) {
    if (titleLower.includes(term.toLowerCase())) {
      return true;
    }
  }
  return titleLower.includes("scar 18") || titleLower.includes("g18");
}

function extractSpecs(title: string) {
  const titleLower = title.toLowerCase();
  let gpu = null;
  let ram = null;
  let storage = null;
  let cpu = null;
  let screen = null;

  const gpuMatch = titleLower.match(/(?:geforce\s)?rtx\s?(\d{3,4})\s?(ti)?/);
  if (gpuMatch) {
    gpu = `RTX ${gpuMatch[1]}${gpuMatch[2] ? ' Ti' : ''}`;
  }

  const ramMatch = titleLower.match(/(\d{1,3})\s*gb(?:\s*ram)?/);
  if (ramMatch) {
    ram = `${ramMatch[1]}GB`;
  }

  const storageMatch = titleLower.match(/(\d{1,4})\s*(tb|gb)(?:\s*(ssd|nvme|pcie))?/);
  if (storageMatch) {
    const unit = storageMatch[2].toUpperCase();
    const typePart = storageMatch[3] ? storageMatch[3].toUpperCase() : 'SSD';
    storage = `${storageMatch[1]}${unit} ${typePart}`;
  }

  const cpuMatch = titleLower.match(/(intel\s?core\s?i[3579]|amd\s?ryzen\s?\d)(?:\s*processor)?/);
  if (cpuMatch) {
    cpu = cpuMatch[0].replace(/\b\w/g, l => l.toUpperCase()); // title case
  }

  if (title.includes("18")) {
    screen = "18-inch";
  } else if (title.includes("17")) {
    screen = "17-inch";
  }

  return { gpu, ram, storage, cpu, screen };
}

async function scrapeBestBuy(page: any, query: string) {
  log(`[BestBuy] ${query}`);
  const url = `https://www.bestbuy.com/site/searchpage.jsp?st=${query.replace(' ', '+')}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    log(`⚠️ BestBuy navigation failed: ${e}`);
    return [];
  }

  await page.waitForTimeout(3000);
  humanScroll(page);

  const items = page.locator('.product-list-item');
  const count = await items.count();
  log(`[BestBuy] Items: ${count}`);
  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i);
      const titleEl = item.locator('.sku-title a');
      const priceEl = item.locator('.priceView-customer-price span');
      if (await titleEl.count() === 0 || await priceEl.count() === 0) continue;
      const title = await titleEl.innerText();
      if (!isRelevant(title, query)) continue;
      const price = await priceEl.innerText();
      const link = 'https://www.bestbuy.com' + await titleEl.getAttribute('href');
      results.push({ title, price, store: 'Best Buy', link });
    } catch {}
  }
  return results;
}

async function scrapeNewegg(page: any, query: string) {
  log(`[Newegg] ${query}`);
  const url = `https://www.newegg.com/p/pl?d=${query.replace(' ', '+')}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    log(`⚠️ Newegg navigation failed: ${e}`);
    return [];
  }

  await page.waitForTimeout(3000);
  humanScroll(page);

  const items = page.locator('.item-cell');
  const count = await items.count();
  log(`[Newegg] Items: ${count}`);
  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i);
      const titleEl = item.locator('.item-title');
      const priceEl = item.locator('.price-current');
      if (await titleEl.count() === 0 || await priceEl.count() === 0) continue;
      const title = await titleEl.innerText();
      if (!isRelevant(title, query)) continue;
      let price = await priceEl.innerText();
      if (price.includes('$')) {
        const parts = price.split('$');
        if (parts.length > 1) price = `$${parts[1]}`;
      }
      const link = await titleEl.getAttribute('href');
      results.push({ title, price, store: 'Newegg', link });
    } catch {}
  }
  return results;
}

async function scrapeBHPhoto(page: any, query: string) {
  log(`[BHPhoto] ${query}`);
  const url = `https://www.bhphotovideo.com/c/search?q=${query.replace(' ', '+')}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    log(`⚠️ BHPhoto navigation failed: ${e}`);
    return [];
  }

  await page.waitForTimeout(3000);
  humanScroll(page);

  const items = page.locator('[data-selenium="miniProductPage"]');
  const count = await items.count();
  log(`[BHPhoto] Items: ${count}`);
  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i);
      const titleEl = item.locator('h3 a');
      const priceEl = item.locator('.price_1DPoTo');
      if (await titleEl.count() === 0 || await priceEl.count() === 0) continue;
      const title = await titleEl.innerText();
      if (!isRelevant(title, query)) continue;
      const price = await priceEl.innerText();
      const link = 'https://www.bhphotovideo.com' + await titleEl.getAttribute('href');
      results.push({ title, price, store: 'B&H Photo', link });
    } catch {}
  }
  return results;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function saveToCSV(data: any[]) {
  try {
    ensureOutputDir();
    const fileExists = fs.existsSync(CSV_FILE);
    const csvData = data.map(row => [
      new Date().toISOString().split('T')[0],
      row.title,
      row.price,
      row.store,
      row.link
    ]);
    if (!fileExists) {
      csvData.unshift(['date', 'title', 'price', 'store', 'link']);
    }
    const escapeField = (field: string) => `"${field.replace(/"/g, '""')}"`;
    const csvContent = csvData.map(row => row.map(escapeField).join(',')).join('\n') + '\n';
    fs.appendFileSync(CSV_FILE, csvContent);
    log(`Saved ${data.length} items to main CSV`);
  } catch (error) {
    log(`Error saving main CSV: ${error.message}`);
  }
}

function saveSpecsToCSV(key: string, data: any[]) {
  try {
    ensureOutputDir();
    const specFile = path.join(OUTPUT_DIR, `spec_comparison_${key}.csv`);
    const specsData = data.map(item => {
      const specs = extractSpecs(item.title);
      return {
        title: item.title,
        price: item.price,
        store: item.store,
        link: item.link,
        gpu: specs.gpu || '',
        ram: specs.ram || '',
        storage: specs.storage || '',
        cpu: specs.cpu || '',
        screen: specs.screen || ''
      };
    });
    const csvData = specsData.map(row => [
      row.title,
      row.price,
      row.store,
      row.link,
      row.gpu,
      row.ram,
      row.storage,
      row.cpu,
      row.screen
    ]);
    csvData.unshift(['title', 'price', 'store', 'link', 'gpu', 'ram', 'storage', 'cpu', 'screen']);
    const escapeField = (field: string) => `"${field.replace(/"/g, '""')}"`;
    const csvContent = csvData.map(row => row.map(escapeField).join(',')).join('\n') + '\n';
    fs.writeFileSync(specFile, csvContent);
    log(`Saved ${data.length} spec items to ${specFile}`);
  } catch (error) {
    log(`Error saving spec CSV for ${key}: ${error.message}`);
  }
}

function checkDeals(data: any[]) {
  const deals = [];
  for (const item of data) {
    const priceVal = cleanPrice(item.price);
    if (!priceVal) continue;
    const title = item.title;
    const titleLower = title.toLowerCase();
    for (const [term, target] of Object.entries(PRICE_TARGETS)) {
      if (titleLower.includes(term.toLowerCase()) && priceVal <= target) {
        log(`🔥 DEAL FOUND (${term}): $${priceVal} - ${item.store}`);
        deals.push({
          title,
          price: item.price,
          store: item.store,
          link: item.link,
          target_price: target,
          savings: (target - priceVal).toFixed(2)
        });
      }
    }
  }
  log(`Found ${deals.length} deals`);
  // Save deals to CSV
  if (deals.length > 0) {
    try {
      ensureOutputDir();
      const dealsFile = path.join(OUTPUT_DIR, 'deals.csv');
      const csvData = deals.map(row => [
        row.title,
        row.price,
        row.store,
        row.link,
        row.target_price.toString(),
        row.savings
      ]);
      csvData.unshift(['title', 'price', 'store', 'link', 'target_price', 'savings']);
      const escapeField = (field: string) => `"${field.replace(/"/g, '""')}"`;
      const csvContent = csvData.map(row => row.map(escapeField).join(',')).join('\n') + '\n';
      fs.writeFileSync(dealsFile, csvContent);
      log(`Saved ${deals.length} deals to CSV`);
    } catch (error) {
      log(`Error saving deals CSV: ${error.message}`);
    }
  }
}

export async function runScraper(logCallback?: (msg: string) => void) {
  globalLogCallback = logCallback;
  log("Loading configuration...");
  loadConfig();
  log(`Loaded ${SEARCH_TERMS.length} search terms: ${SEARCH_TERMS.join(', ')}`);
  const browser = await chromium.launch({ headless: true });
  log("Browser launched");
  const context = await browser.newContext();
  const page = await context.newPage();

  const allData = [];
  for (const term of SEARCH_TERMS) {
    log(`Scraping for term: ${term}`);
    try {
      const bestbuy = await scrapeBestBuy(page, term);
      log(`BestBuy: ${bestbuy.length} items`);
      const newegg = await scrapeNewegg(page, term);
      log(`Newegg: ${newegg.length} items`);
      const bhphoto = await scrapeBHPhoto(page, term);
      log(`BHPhoto: ${bhphoto.length} items`);
      const termData = [...bestbuy, ...newegg, ...bhphoto];
      allData.push(...termData);
      log(`Total for ${term}: ${termData.length} items`);
      // Save specs for this term
      const key = term.split(' ')[3].toLowerCase();
      saveSpecsToCSV(key, termData);
      log(`Saved spec CSV for ${key}`);
    } catch (error) {
      log(`Error scraping ${term}: ${error.message}`);
    }
  }

  await browser.close();
  log("Browser closed");

  log(`Total items scraped: ${allData.length}`);
  checkDeals(allData);
  saveToCSV(allData);
  log("Saved main CSV and deals CSV");

  return allData;
}