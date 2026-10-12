import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width':412,'height':880}, is_mobile=True, has_touch=True)
        pg = await c.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.text)); pg.on('response', lambda r: logs.append(f'{r.status} {r.url[:120]}') if 'search' in r.url or 'commons' in r.url else None)
        await pg.goto(B); await pg.wait_for_timeout(1500)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(1500)
        await pg.locator('.search-box input').click(); await pg.locator('.search-box input').fill('waterfall'); await pg.wait_for_timeout(1500)
        await pg.locator('.tabs button').nth(1).click(); await pg.wait_for_timeout(5000)
        print('tiles', await pg.locator('.grid-item').count())
        print('\n'.join(logs[-15:]))
        await b.close()
asyncio.run(main())
