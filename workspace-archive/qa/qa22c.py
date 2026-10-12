import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'
O='/home/user/shots/v22/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width':412,'height':900}, device_scale_factor=1.5, is_mobile=True, has_touch=True)
        pg = await c.new_page(); pg.set_default_timeout(10000); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        async def shot(n): await pg.wait_for_timeout(1500); await pg.screenshot(path=O+n+'.png')
        async def back(): await pg.locator('.topbar button, .top-bar button').first.click()
        await pg.goto(B); await pg.wait_for_timeout(2000)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(3500)
        # notifications
        await pg.locator('.feed-header button').last.click(); await shot('11-notifs')
        await pg.locator('.screen-stack [aria-label="back"], [aria-label="back"]').last.click(); await pg.wait_for_timeout(800)
        # create
        await pg.locator('.feed-header button').first.click(); await shot('12-create')
        await pg.locator('.topbar .icon-btn').last.click() if False else await pg.locator('header.topbar button').first.click(); await pg.wait_for_timeout(800)
        # search becetti
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(1000)
        await pg.locator('input').first.fill('becetti'); await pg.wait_for_timeout(2500); await shot('13-search')
        await pg.get_by_text('becetti', exact=True).locator('visible=true').first.click(); await shot('14-user')
        g = pg.locator('.grid-item')
        if await g.count():
            await g.first.click(); await shot('15-post')
        print('grid', await g.count(), errs)
        await b.close()
asyncio.run(main())
