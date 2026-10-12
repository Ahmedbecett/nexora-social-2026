import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v25/ar-'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5, is_mobile=True, has_touch=True, locale='ar')
        pg = await c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(1000); await pg.evaluate("localStorage.setItem('nx_lang','ar')"); await pg.goto(B); await pg.wait_for_timeout(1500)
        await pg.fill('input >> nth=0', 'official.nexora'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(5000)
        await pg.locator('.bottom-nav button').nth(1).click(); await pg.wait_for_timeout(7000); await pg.screenshot(path=O+'1.png')
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(4000); await pg.screenshot(path=O+'2.png')
        await pg.locator('.search-box input').click(); await pg.locator('.search-box input').fill('بيستي'); await pg.wait_for_timeout(2500); await pg.screenshot(path=O+'3.png')
        await pg.goto(B); await pg.wait_for_timeout(3000)
        await pg.locator('.bottom-nav button').last.click(); await pg.wait_for_timeout(4000); await pg.screenshot(path=O+'4.png')
        print('errors', errs); await b.close()
asyncio.run(main())
