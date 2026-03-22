from playwright.sync_api import sync_playwright
import csv
from datetime import datetime
import os
import time
import random
import re
import json

OUTPUT_DIR = "csv_output"
CSV_FILE = os.path.join(OUTPUT_DIR, "laptop_price_tracking.csv")
CONFIG_FILE = "scraper_config.json"

# Load config from JSON, with defaults
def load_config():
    global SEARCH_TERMS, PRICE_TARGETS
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                SEARCH_TERMS = config.get("searchTerms", ["ASUS ROG Strix SCAR 18", "ASUS ROG Strix G18"])
                PRICE_TARGETS = config.get("priceTargets", {"ASUS ROG Strix SCAR 18": 2500, "ASUS ROG Strix G18": 2100})
        except Exception as e:
            log(f"⚠️ Failed to load config: {e}, using defaults")
            SEARCH_TERMS = ["ASUS ROG Strix SCAR 18", "ASUS ROG Strix G18"]
            PRICE_TARGETS = {"ASUS ROG Strix SCAR 18": 2500, "ASUS ROG Strix G18": 2100}
    else:
        SEARCH_TERMS = ["ASUS ROG Strix SCAR 18", "ASUS ROG Strix G18"]
        PRICE_TARGETS = {"SCAR": 2500, "G18": 2100}

# Initialize with defaults
SEARCH_TERMS = ["ASUS ROG Strix SCAR 18", "ASUS ROG Strix G18"]
PRICE_TARGETS = {
    "ASUS ROG Strix SCAR 18": 2500,
    "ASUS ROG Strix G18": 2100
}  # term -> max price for deal, lower is better.


def log(msg):
    print(f"[LOG] {msg}")

def clean_price(price_str):
    try:
        return float(price_str.replace("$", "").replace(",", "").strip())
    except:
        return None

# ----------------------------
# HUMAN BEHAVIOR
# ----------------------------
def human_scroll(page):
    page.mouse.wheel(0, 1500)
    page.wait_for_timeout(random.randint(1000, 2000))
    page.mouse.wheel(0, 1500)
    page.wait_for_timeout(random.randint(1000, 2000))

# ----------------------------
# FILTER
# ----------------------------
def is_relevant(title, query=None):
    title_lower = title.lower()

    if query:
        return query.lower() in title_lower

    # Use configured terms to determine relevance
    for term in SEARCH_TERMS:
        if term.lower() in title_lower:
            return True

    # Fall back to known patterns
    return "scar 18" in title_lower or "g18" in title_lower

# ----------------------------
# EXTRACT SPECS
# ----------------------------
def extract_specs(title):
    title_lower = title.lower()
    gpu = None
    ram = None
    storage = None
    cpu = None
    screen = None

    gpu_match = re.search(r"(?:geforce\s)?rtx\s?(\d{3,4})\s?(ti)?", title_lower)
    if gpu_match:
        gpu = f"RTX {gpu_match.group(1)}{' Ti' if gpu_match.group(2) else ''}"

    # Capture common RAM expressions: 8GB, 16 GB, 32GB RAM, 64 GB DDR5 etc.
    ram_match = re.search(r"(\d{1,3})\s*gb(?:\s*ram)?", title_lower)
    if ram_match:
        ram = f"{ram_match.group(1)}GB"

    storage_match = re.search(r"(\d{1,4})\s*(tb|gb)(?:\s*(ssd|nvme|pcie))?", title_lower)
    if storage_match:
        unit = storage_match.group(2).upper()
        type_part = storage_match.group(3).upper() if storage_match.group(3) else "SSD"
        storage = f"{storage_match.group(1)}{unit} {type_part}"

    cpu_match = re.search(r"(intel\s?core\s?i[3579]|amd\s?ryzen\s?\d)", title_lower)
    if cpu_match:
        cpu = cpu_match.group().title()

    if "18" in title:
        screen = "18-inch"
    elif "17" in title:
        screen = "17-inch"

    return {
        "gpu": gpu,
        "ram": ram,
        "storage": storage,
        "cpu": cpu,
        "screen": screen
    }

# ----------------------------
# NEWEGG PRICE FIX
# ----------------------------
def clean_newegg_price(price_el):
    try:
        whole = price_el.query_selector("strong").inner_text()
        fraction = price_el.query_selector("sup").inner_text()
        return f"${whole}.{fraction}"
    except:
        return price_el.inner_text()

# ----------------------------
# CSV SAVE
# ----------------------------
def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def save_to_csv(data):
    ensure_output_dir()
    file_exists = os.path.isfile(CSV_FILE)

    with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        if not file_exists:
            writer.writerow(["date", "title", "price", "store", "link"])

        for row in data:
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d"),
                row["title"],
                row["price"],
                row["store"],
                row["link"]
            ])

def save_deals_csv(deals):
    if not deals:
        return

    ensure_output_dir()
    filename = os.path.join(OUTPUT_DIR, f"deals_{datetime.now().strftime('%Y-%m-%d_%H%M')}.csv")

    with open(filename, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["title","price","store","gpu","ram","storage","cpu","screen","link"])

        for item in deals:
            specs = extract_specs(item["title"])
            writer.writerow([
                item["title"],
                item["price"],
                item["store"],
                specs["gpu"],
                specs["ram"],
                specs["storage"],
                specs["cpu"],
                specs["screen"],
                item["link"]
            ])

    log(f"💾 Deals saved to {filename}")

# ----------------------------
# DEDUPE
# ----------------------------
def dedupe_results(results):
    seen = set()
    unique = []
    for item in results:
        key = (item["title"], item["price"], item["store"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique

# ----------------------------
# LOWEST PRICE TRACKING
# ----------------------------
def get_lowest_prices():
    if not os.path.exists(CSV_FILE):
        return {}
    lowest = {}
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            price = clean_price(row["price"])
            if not price:
                continue
            title = row["title"]
            if title not in lowest or price < lowest[title]:
                lowest[title] = price
    return lowest

# ----------------------------
# DEAL CHECKING
# ----------------------------
def check_deals(data):
    lowest_prices = get_lowest_prices()
    deals_found = []
    prices_parsed = 0
    prices_failed = 0

    for item in data:
        price_val = clean_price(item["price"])
        if not price_val:
            prices_failed += 1
            continue
        prices_parsed += 1
        title = item["title"]
        title_lower = title.lower()
        is_deal = False

        # Dynamic target matching from config
        for term, target in PRICE_TARGETS.items():
            if term.lower() in title_lower and price_val <= target:
                print(f"🔥 DEAL FOUND ({term}): ${price_val} - {item['store']}")
                is_deal = True

        if title in lowest_prices and price_val < lowest_prices[title]:
            print(f"📉 NEW LOW PRICE: {title} → ${price_val}")
            is_deal = True

        if is_deal:
            deals_found.append(item)

    log(f"Prices parsed: {prices_parsed}, failed to parse: {prices_failed}")
    if not deals_found:
        log(f"ℹ️ No deals found (targets: {PRICE_TARGETS})")

    return deals_found

# ----------------------------
# SPEC COMPARISON
# ----------------------------
def save_spec_comparison_csv(data):
    # Group results by configured search terms
    product_groups = {}

    for term in SEARCH_TERMS:
        product_groups[term] = []
    product_groups["unmatched"] = []

    for item in data:
        title_lower = item["title"].lower()
        matched = False

        for term in SEARCH_TERMS:
            if term.lower() in title_lower:
                product_groups[term].append(item)
                matched = True
                break

        if not matched:
            product_groups["unmatched"].append(item)

    # Process each product group
    for product_name, items in product_groups.items():
        if not items:
            continue

        # Sort by price and get top 10
        sorted_items = sorted(items, key=lambda x: clean_price(x["price"]) or float('inf'))
        top_10 = sorted_items[:10]

        # Create comparison CSV
        ensure_output_dir()
        safe_name = product_name.lower().replace(" ", "_").replace("/", "_")
        filename = os.path.join(OUTPUT_DIR, f"spec_comparison_{safe_name}_{datetime.now().strftime('%Y-%m-%d_%H%M')}.csv")
        
        with open(filename, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["rank", "title", "price", "store", "gpu", "ram", "storage", "cpu", "screen", "link"])
            
            for rank, item in enumerate(top_10, 1):
                specs = extract_specs(item["title"])
                writer.writerow([
                    rank,
                    item["title"],
                    item["price"],
                    item["store"],
                    specs["gpu"] or "",
                    specs["ram"] or "",
                    specs["storage"] or "",
                    specs["cpu"] or "",
                    specs["screen"] or "",
                    item["link"]
                ])
        
        log(f"💾 Spec comparison for {product_name.upper()} saved to {filename}")

# ----------------------------
# BEST BUY
# ----------------------------
def scrape_bestbuy(page, query):
    log(f"[BestBuy] {query}")
    url = f"https://www.bestbuy.com/site/searchpage.jsp?st={query.replace(' ','+')}"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
    except Exception as e:
        log(f"⚠️ BestBuy navigation failed: {e}")
        return []

    page.wait_for_timeout(3000)
    human_scroll(page)

    items = page.query_selector_all(".product-list-item")
    log(f"[BestBuy] Items: {len(items)}")
    results = []

    for item in items:
        try:
            title_el = item.query_selector(".sku-title a")
            price_el = item.query_selector(".priceView-customer-price span")
            if not title_el or not price_el:
                continue
            title = title_el.inner_text()
            if not is_relevant(title, query):
                continue
            results.append({
                "title": title,
                "price": price_el.inner_text(),
                "store": "Best Buy",
                "link": "https://www.bestbuy.com" + title_el.get_attribute("href")
            })
        except:
            continue
    return results

# ----------------------------
# NEWEGG
# ----------------------------
def scrape_newegg(page, query):
    log(f"[Newegg] {query}")
    url = f"https://www.newegg.com/p/pl?d={query.replace(' ','+')}"
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    human_scroll(page)

    items = page.query_selector_all(".item-cell")
    log(f"[Newegg] Items: {len(items)}")
    results = []

    for item in items:
        try:
            title_el = item.query_selector(".item-title")
            price_el = item.query_selector(".price-current")
            if not title_el or not price_el:
                continue
            title = title_el.inner_text()
            if not is_relevant(title, query):
                continue
            results.append({
                "title": title,
                "price": clean_newegg_price(price_el),
                "store": "Newegg",
                "link": title_el.get_attribute("href")
            })
        except:
            continue
    return results

# ----------------------------
# B&H PHOTO VIDEO
# ----------------------------
def scrape_bhphoto(page, query):
    log(f"[B&H] {query}")
    url = f"https://www.bhphotovideo.com/c/search?Ntt={query.replace(' ','+')}&N=0&InitialSearch=yes&sts=ma"
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    human_scroll(page)

    items = page.query_selector_all(".productListItem")
    log(f"[B&H] Items: {len(items)}")
    results = []

    for item in items:
        try:
            title_el = item.query_selector(".itemTitle a")
            price_el = item.query_selector(".price_1DPoToKrLP8")
            if not title_el or not price_el:
                continue
            title = title_el.inner_text()
            if not is_relevant(title, query):
                continue
            results.append({
                "title": title,
                "price": price_el.inner_text(),
                "store": "B&H",
                "link": title_el.get_attribute("href")
            })
        except:
            continue
    return results

# ----------------------------
# MAIN
# ----------------------------
def main():
    load_config()  # Load latest config from JSON
    all_results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")

        for term in SEARCH_TERMS:
            log(f"🔎 Scraping term: {term}")

            term_results = []
            term_results.extend(scrape_bestbuy(page, term))
            term_results.extend(scrape_newegg(page, term))
            term_results.extend(scrape_bhphoto(page, term))

            log(f"✅ {term} results found: {len(term_results)}")

            all_results.extend(term_results)
            time.sleep(random.uniform(2,5))

        browser.close()

    log(f"Total raw results: {len(all_results)}")
    all_results = dedupe_results(all_results)
    log(f"After dedupe: {len(all_results)}")

    if all_results:
        save_to_csv(all_results)
        save_spec_comparison_csv(all_results)
        deals = check_deals(all_results)
        save_deals_csv(deals)
        log("Saved all results + spec comparison + deals.")
    else:
        log("⚠️ No results found.")

if __name__ == "__main__":
    main()