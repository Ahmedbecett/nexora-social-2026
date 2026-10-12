import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v24/'
VID="(()=>{const v=[...document.querySelectorAll('.reel-video')].find(x=>{const r=x.getBoundingClientRect();return r.top>-5&&r.top<50&&x.offsetParent});return v?{paused:v.paused,muted:v.muted,t:+v.currentTime.toFixed(2),ready:v.readyState,src:v.currentSrc.slice(0,60)}:null})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5, is_mobile=True, has_touch=True, locale='ar')
        pg = await c.new_page(); pg.set_default_timeout(20000); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(2000)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(6000)
        await pg.screenshot(path=O+'20-feed-fallback.png')
        await pg.locator('.bottom-nav button').nth(1).click(); await pg.wait_for_timeout(8000)
        print('fallback reel', await pg.evaluate(VID)); await pg.screenshot(path=O+'21-reel-fallback.png')
        await pg.evaluate("document.querySelector('.reels').scrollBy(0, document.querySelector('.reels').clientHeight)"); await pg.wait_for_timeout(5000)
        print('next', await pg.evaluate(VID), await pg.evaluate("document.querySelectorAll('.reel').length"))
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(6000)
        print('explore tiles', await pg.evaluate("document.querySelectorAll('.grid-item').length"))
        print('errors', errs)
        await b.close()
asyncio.run(main())
