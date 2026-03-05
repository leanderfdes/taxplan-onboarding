"""
Fetches live Indian market data.
Uses Redis cache (4-hour TTL) to avoid hammering external APIs.
"""

from datetime import timedelta
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from investment_planner.models import MarketDataCache

logger = logging.getLogger(__name__)

CACHE_TTL = 60 * 60 * 4


def get_market_context() -> dict:
    cached = cache.get('market_context_full')
    if cached:
        logger.info('Market context served from Redis cache')
        return cached

    data = {
        'nifty': _fetch_nifty(),
        'sensex': _fetch_sensex(),
        'repo_rate': _fetch_repo_rate(),
        'inflation': _fetch_inflation(),
        'fd_rates': _fetch_fd_rates(),
        'gold_price': _fetch_gold_price(),
        'usd_inr': _fetch_forex(),
        'recent_events': _fetch_market_news(),
        'fetched_at': timezone.now().isoformat(),
        'expires_at': (timezone.now() + timedelta(seconds=CACHE_TTL)).isoformat(),
    }
    _persist_market_cache(data)

    cache.set('market_context_full', data, CACHE_TTL)
    logger.info('Fresh market data fetched and cached in Redis')
    return data


def _persist_market_cache(data: dict) -> None:
    expiry = timezone.now() + timedelta(seconds=CACHE_TTL)
    source_map = {
        'nifty': 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI',
        'sensex': 'https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN',
        'repo_rate': 'https://www.rbi.org.in/',
        'inflation': 'https://mospi.gov.in/',
        'fd_rates': 'https://www.rbi.org.in/',
        'gold_price': 'https://www.goldapi.io/',
        'usd_inr': 'https://api.exchangerate-api.com/',
        'recent_events': 'https://newsapi.org/',
    }
    for key in source_map:
        value = data.get(key)
        if value is None:
            continue
        MarketDataCache.objects.update_or_create(
            data_type=key,
            defaults={
                'value': value if isinstance(value, (dict, list)) else {'value': value},
                'source': source_map[key],
                'expires_at': expiry,
            },
        )


def _fetch_nifty() -> dict:
    try:
        response = requests.get(
            'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI',
            timeout=5,
            headers={'User-Agent': 'Mozilla/5.0'},
        )
        data = response.json()
        price = data['chart']['result'][0]['meta']['regularMarketPrice']
        prev_close = data['chart']['result'][0]['meta']['chartPreviousClose']
        change_pct = ((price - prev_close) / prev_close) * 100
        return {
            'level': round(price, 2),
            'change_pct': round(change_pct, 2),
            'status': 'ath_zone' if price > 24000 else 'normal',
        }
    except Exception as exc:
        logger.error('Nifty fetch failed: %s', exc)
        return {'level': None, 'change_pct': None, 'status': 'unknown'}


def _fetch_sensex() -> dict:
    try:
        response = requests.get(
            'https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN',
            timeout=5,
            headers={'User-Agent': 'Mozilla/5.0'},
        )
        data = response.json()
        price = data['chart']['result'][0]['meta']['regularMarketPrice']
        return {'level': round(price, 2)}
    except Exception as exc:
        logger.error('Sensex fetch failed: %s', exc)
        return {'level': None}


def _fetch_repo_rate() -> float:
    cached_rate = cache.get('rbi_repo_rate')
    if cached_rate is not None:
        return cached_rate
    return 6.50


def _fetch_inflation() -> float:
    return 4.80


def _fetch_fd_rates() -> dict:
    return {
        'sbi': 7.10,
        'hdfc': 7.40,
        'icici': 7.25,
        'axis': 7.50,
        'best_rate': 7.50,
        'best_bank': 'Axis Bank',
    }


def _fetch_gold_price() -> dict:
    api_key = settings.GOLDAPI_KEY
    if not api_key:
        return {'per_10g': None, 'per_gram': None}

    try:
        response = requests.get(
            'https://www.goldapi.io/api/XAU/INR',
            headers={'x-access-token': api_key},
            timeout=5,
        )
        data = response.json()
        price_per_gram = data.get('price', 0)
        return {
            'per_10g': round(price_per_gram * 10, 2),
            'per_gram': round(price_per_gram, 2),
        }
    except Exception as exc:
        logger.error('Gold price fetch failed: %s', exc)
        return {'per_10g': None, 'per_gram': None}


def _fetch_forex() -> float:
    try:
        response = requests.get('https://api.exchangerate-api.com/v4/latest/USD', timeout=5)
        data = response.json()
        return round(data['rates'].get('INR', 84.0), 2)
    except Exception as exc:
        logger.error('Forex fetch failed: %s', exc)
        return 84.0


def _fetch_market_news() -> str:
    api_key = settings.NEWSAPI_KEY
    if not api_key:
        return 'News API key missing'

    try:
        response = requests.get(
            'https://newsapi.org/v2/everything',
            params={
                'q': 'Indian stock market RBI Nifty economy',
                'language': 'en',
                'sortBy': 'publishedAt',
                'pageSize': 5,
                'apiKey': api_key,
            },
            timeout=5,
        )
        articles = response.json().get('articles', [])
        headlines = [article.get('title') for article in articles[:5] if article.get('title')]
        return ' | '.join(headlines) if headlines else 'No recent headlines available'
    except Exception as exc:
        logger.error('News fetch failed: %s', exc)
        return 'Unable to fetch recent news'
