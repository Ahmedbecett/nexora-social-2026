import asyncio, sys
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width':412,'height':900}, device_scale_factor=1.5, is_mobile=True, has_touch=True)
        pg = await c.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        await pg.goto(B); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='/home/user/shots/v22/01-login.png')
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com')
        await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
        await pg.screenshot(path='/home/user/shots/v22/02-feed.png')
        navs = pg.locator('.bottom-nav button')
        n = await navs.count(); print('nav', n)
        names=['home','reels','messages','search','profile']
        for i in range(1,n):
            await navs.nth(i).click(); await pg.wait_for_timeout(2500)
            await pg.screenshot(path=f'/home/user/shots/v22/0{i+2}-{names[i] if i<5 else i}.png')
        print('errors', errs[:10])
        await b.close()
asyncio.run(main())
