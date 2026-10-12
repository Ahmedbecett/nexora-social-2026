import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width':412,'height':900}, device_scale_factor=1.5, is_mobile=True, has_touch=True)
        pg = await c.new_page(); pg.set_default_timeout(10000); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(2000)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(3500)
        await pg.locator('.bottom-nav button').nth(4).click(); await pg.wait_for_timeout(1500)
        await pg.locator('[aria-label="settings"]').click(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/home/user/shots/v22/07-menu.png')
        t = pg.get_by_text('Theme', exact=True)
        await t.first.scroll_into_view_if_needed(); await pg.screenshot(path='/home/user/shots/v22/08-settings.png')
        await t.first.click(); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='/home/user/shots/v22/09-theme.png')
        await pg.get_by_text('Light', exact=True).click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/home/user/shots/v22/10-light.png')
        await pg.get_by_text('Dark', exact=True).click(); await pg.wait_for_timeout(500)
        print(errs)
        await b.close()
asyncio.run(main())
