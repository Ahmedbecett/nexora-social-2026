import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v22/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width':412,'height':900}, device_scale_factor=1.5, is_mobile=True, has_touch=True, timezone_id='Africa/Algiers')
        await c.add_init_script("localStorage.setItem('nx_lang','ar')")
        pg = await c.new_page(); pg.set_default_timeout(10000); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=O+'20-ar-login.png')
        await pg.get_by_text('المتابعة برقم الهاتف').first.click(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=O+'21-ar-phone.png')
        await pg.locator('[aria-label="back"]').first.click(); await pg.wait_for_timeout(800)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path=O+'22-ar-feed.png')
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(800)
        await pg.locator('input').first.fill('becetti'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=O+'23-ar-search.png')
        print(errs); await b.close()
asyncio.run(main())
