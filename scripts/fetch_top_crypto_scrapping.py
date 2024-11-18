import asyncio
from playwright.async_api import async_playwright
import yaml
import time
import random
from loguru import logger
import os
from datetime import datetime
import argparse
from bs4 import BeautifulSoup
import aiohttp
import hashlib
from urllib.parse import urlparse
from pathlib import Path

# Constants
BASE_URL = "https://www.coingecko.com"
COINS_PER_PAGE = 100
TOTAL_COINS = 512
PAGES = TOTAL_COINS // COINS_PER_PAGE
DATA_DIR = "./data"
PROGRESS_FILE = os.path.join(DATA_DIR, "scraping_progress.yaml")
LOGOS_DIR = os.path.join(DATA_DIR, "logos")

def get_output_file():
    """Generate output filename with current date"""
    date_str = datetime.now().strftime("%Y-%m-%d")
    return os.path.join(DATA_DIR, f"top_500_coins_{date_str}.yaml")

def load_progress():
    """Load previous progress if exists"""
    try:
        if os.path.exists(PROGRESS_FILE):
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                progress = yaml.safe_load(f)
                return progress.get('coins', []), progress.get('last_page', 1), progress.get('last_index', 0)
    except Exception as e:
        logger.error(f"Error loading progress: {e}")
    return [], 1, 0

def save_progress(coins, current_page, current_index):
    """Save current progress"""
    try:
        # Ensure data directory exists
        os.makedirs(DATA_DIR, exist_ok=True)
        
        # Save progress
        progress = {
            'coins': coins,
            'last_page': current_page,
            'last_index': current_index,
            'last_updated': datetime.now().isoformat()
        }
        
        # Save progress file
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(progress, f, allow_unicode=True)
            
        # Save current results
        output_file = get_output_file()
        with open(output_file, 'w', encoding='utf-8') as f:
            yaml.dump(coins, f, allow_unicode=True)
            
    except Exception as e:
        logger.error(f"Error saving progress: {e}")

async def get_page_content(page, url, retries=3):
    """
    Fetches page content using Playwright with retry mechanism
    """
    for attempt in range(retries):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait for the table to be visible - updated selector
            await page.wait_for_selector('table.sort-table', timeout=30000)
            # Scroll down a bit to trigger any lazy loading
            await page.evaluate("window.scrollBy(0, 200)")
            await page.wait_for_timeout(1000)  # Wait for 1 second after scroll
            return await page.content()
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(5)
            else:
                logger.error(f"Failed to fetch {url} after {retries} attempts")
                return None

def parse_coin_list_page(html_content):
    """
    Parses the coin list page and returns a list of coins with basic info.
    """
    coins = []
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find all coin rows
    rows = soup.select('table tbody tr[data-view-component="true"]')
    
    for row in rows:
        try:
            # Find the coin cell with name and ticker
            name_cell = row.select_one('td:nth-child(3)')
            if not name_cell:
                continue

            # Get name and ticker
            name_div = name_cell.select_one('div[data-view-component="true"]')
            if not name_div:
                continue

            name = name_div.get_text().strip().split('\n')[0].strip()
            ticker = name_div.select_one('div.tw-block').get_text().strip() if name_div.select_one('div.tw-block') else None
            
            # Get logo
            logo = name_cell.select_one('img')
            logo_url = logo['src'] if logo else None
            
            # Get market cap (7th column)
            market_cap = row.select_one('td:nth-child(8) span')
            market_cap_value = market_cap.get_text().strip() if market_cap else None
            
            # Get link
            link = name_cell.select_one('a')
            coin_link = BASE_URL + link['href'] if link and link.get('href') else None

            if all([name, ticker, market_cap_value, coin_link]):
                coins.append({
                    'logo': logo_url,
                    'name': name,
                    'ticker': ticker,
                    'marketcap': market_cap_value,
                    'link': coin_link
                })
        except Exception as e:
            logger.error(f"Error parsing coin row: {e}")
            continue
            
    return coins

async def parse_coin_detail_page(page, url):
    """
    Parses the coin's detail page to extract description and website(s).
    """
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        # Wait for the statistics table to load
        await page.wait_for_selector('#gecko-coin-page-container', timeout=30000)
        html_content = await page.content()

        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Initialize data structures
        websites = []
        description = ""
        community_links = {}
        source_code = ""
        market_stats = {}
        
        # Get description
        description_div = soup.select_one('#about > div > div.coin-page-read-more > div:nth-child(2)')
        if description_div:
            description = description_div.get_text().strip()
        
        # Process info sections (websites, community, source code)
        info_sections = soup.find_all('div', {'class': 'tw-flex tw-justify-between tw-py-3'})
        
        for section in info_sections:
            label = section.find('div', {'class': 'tw-my-auto tw-text-left'})
            if not label:
                continue
            label_text = label.text.strip()
            
            if label_text == "Website":
                website_links = section.find_all('a', {'target': '_blank'})
                websites = [link['href'] for link in website_links if link.get('href', '').startswith('http')]
            
            elif label_text == "Community":
                community_links_elements = section.find_all('a', {'target': '_blank'})
                for link in community_links_elements:
                    href = link.get('href')
                    text = link.text.strip()
                    if href and href.startswith('http'):
                        community_links[text] = href
            
            elif label_text == "Source Code":
                source_link = section.find('a', {'target': '_blank'})
                if source_link:
                    source_code = source_link.get('href', '')

        # Get market statistics using specific selectors
        stats_container = soup.select_one('#gecko-coin-page-container > div.\\32lg\\:tw-row-span-2.\\32lg\\:tw-pr-6.\\32lg\\:tw-border-r.tw-border-gray-200.dark\\:tw-border-moon-700.tw-flex.tw-flex-col > div:nth-child(2) > table > tbody')
        
        if stats_container:
            # Market Cap (1st row)
            market_cap = stats_container.select_one('tr:nth-child(1) > td > span')
            if market_cap:
                market_stats['Market Cap'] = market_cap.get_text(strip=True)

            # Market Cap / FDV (2nd row)
            mcap_fdv = stats_container.select_one('tr:nth-child(2) > td')
            if mcap_fdv:
                market_stats['Market Cap / FDV'] = mcap_fdv.get_text(strip=True)

            # Fully Diluted Valuation (3rd row)
            fdv = stats_container.select_one('tr:nth-child(3) > td > span')
            if fdv:
                market_stats['Fully Diluted Valuation'] = fdv.get_text(strip=True)

            # 24h Trading Volume (4th row)
            volume = stats_container.select_one('tr:nth-child(4) > td > span')
            if volume:
                market_stats['24 Hour Trading Vol'] = volume.get_text(strip=True)

            # Circulating Supply (5th row)
            circ_supply = stats_container.select_one('tr:nth-child(5) > td')
            if circ_supply:
                market_stats['Circulating Supply'] = circ_supply.get_text(strip=True).split('\n')[0].strip()

            # Total Supply (6th row)
            total_supply = stats_container.select_one('tr:nth-child(6) > td')
            if total_supply:
                market_stats['Total Supply'] = total_supply.get_text(strip=True)

            # Max Supply (7th row)
            max_supply = stats_container.select_one('tr:nth-child(7) > td')
            if max_supply:
                market_stats['Max Supply'] = max_supply.get_text(strip=True)

        # Create the final data structure
        coin_data = {
            'description': description,
            'websites': websites,
            'community': community_links,
            'source_code': source_code,
            'market_stats': {
                'market_cap': market_stats.get('Market Cap'),
                'market_cap_fdv_ratio': market_stats.get('Market Cap / FDV'),
                'fully_diluted_valuation': market_stats.get('Fully Diluted Valuation'),
                'trading_volume_24h': market_stats.get('24 Hour Trading Vol'),
                'circulating_supply': market_stats.get('Circulating Supply'),
                'total_supply': market_stats.get('Total Supply'),
                'max_supply': market_stats.get('Max Supply')
            }
        }
        
        return coin_data

    except Exception as e:
        logger.error(f"Error parsing detail page {url}: {e}")
        return {
            'description': "",
            'websites': [],
            'community': {},
            'source_code': "",
            'market_stats': {
                'market_cap': None,
                'market_cap_fdv_ratio': None,
                'fully_diluted_valuation': None,
                'trading_volume_24h': None,
                'circulating_supply': None,
                'total_supply': None,
                'max_supply': None
            }
        }

async def download_logo(session, logo_url, coin_ticker):
    """
    Downloads and saves a coin's logo.
    Returns the local path to the saved logo.
    """
    if not logo_url:
        return None
        
    try:
        # Create logos directory if it doesn't exist
        os.makedirs(LOGOS_DIR, exist_ok=True)
        
        # Get file extension from URL or default to .png
        ext = os.path.splitext(urlparse(logo_url).path)[1]
        if not ext:
            ext = '.png'
            
        # Create filename using ticker and URL hash for uniqueness
        url_hash = hashlib.md5(logo_url.encode()).hexdigest()[:8]
        filename = f"{coin_ticker.lower()}{ext}"
        filepath = os.path.join(LOGOS_DIR, filename)
        
        # If logo already exists, return the path
        if os.path.exists(filepath):
            return filepath
            
        # Download the logo
        async with session.get(logo_url) as response:
            if response.status == 200:
                with open(filepath, 'wb') as f:
                    f.write(await response.read())
                return filepath
                
    except Exception as e:
        logger.error(f"Error downloading logo for {coin_ticker}: {e}")
        return None

async def scrape_coingecko_top_coins(resume=False):
    """
    Main function to scrape top 500 coins from CoinGecko using Playwright.
    """
    # Load previous progress if resuming
    all_coins, start_page, start_index = load_progress() if resume else ([], 1, 0)
    
    if resume and all_coins:
        logger.info(f"Resuming from page {start_page}, index {start_index} with {len(all_coins)} coins already scraped")
    
    async with async_playwright() as p, aiohttp.ClientSession() as session:
        browser = await p.chromium.launch(
            headless=False,  # Set to True for production
            args=['--disable-dev-shm-usage']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        )
        
        page = await context.new_page()
        
        for page_num in range(start_page, PAGES + 1):
            url = f"{BASE_URL}/?page={page_num}"
            logger.info(f"Scraping page {page_num}: {url}")
            
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_selector('table tbody tr', timeout=30000)
                await page.wait_for_timeout(2000)
                
                html_content = await page.content()
                coins = parse_coin_list_page(html_content)
                logger.info(f"Found {len(coins)} coins on page {page_num}")
                
                # Determine starting index for this page
                page_start_index = start_index if page_num == start_page else 0
                
                for idx, coin in enumerate(coins[page_start_index:], start=page_start_index + 1):
                    logger.info(f"Scraping details for coin #{idx + (page_num-1)*COINS_PER_PAGE}: {coin['name']} ({coin['ticker']})")
                    
                    try:
                        # Download logo
                        if coin['logo']:
                            local_logo_path = await download_logo(session, coin['logo'], coin['ticker'])
                            if local_logo_path:
                                coin['logo_local'] = os.path.relpath(local_logo_path, DATA_DIR)
                        
                        # Get coin details
                        coin_data = await parse_coin_detail_page(page, coin['link'])
                        coin.update(coin_data)
                        del coin['link']
                        
                        all_coins.append(coin)
                        
                        # Save progress after each coin
                        save_progress(all_coins, page_num, idx)
                        
                        await page.wait_for_timeout(random.randint(2000, 4000))
                        
                    except Exception as e:
                        logger.error(f"Error processing coin {coin['name']}: {e}")
                        continue
                
                # Reset start_index after completing a page
                start_index = 0
                
            except Exception as e:
                logger.error(f"Error processing page {page_num}: {e}")
                continue
            
            await page.wait_for_timeout(random.randint(4000, 6000))
        
        await browser.close()
        
        # Clear progress file after successful completion
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            
        return all_coins

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Scrape top 512 cryptocurrencies from CoinGecko')
    parser.add_argument('--resume', action='store_true', help='Resume from last saved progress')
    args = parser.parse_args()
    
    # Set up logging
    logger.add("coingecko_scraper.log", rotation="500 MB")
    
    # Run the scraper
    results = asyncio.run(scrape_coingecko_top_coins(resume=args.resume))
    print(f"Scraped {len(results)} coins successfully.")
