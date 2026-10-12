import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v26/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5, is_mobile=True, has_touch=True)
        pg = await c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(1000); await pg.evaluate("localStorage.setItem('nx_lang','en')"); await pg.goto(B); await pg.wait_for_timeout(1500)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(7000)
        await pg.screenshot(path=O+'1-home.png')
        print('world posts', await pg.locator('.world-post').count())
        await pg.evaluate("document.querySelector('.world-post').scrollIntoView()"); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=O+'2-home-video.png')
        print('playing', await pg.evaluate("[...document.querySelectorAll('.world-post video')].map(v=>!v.paused).filter(Boolean).length"))
        sc = "document.querySelector('.screen .scroll')"
        for i in range(6):
            await pg.evaluate(f"{sc}.scrollBy(0, 700)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=O+'3-home-scrolled.png')
        print('world posts after scroll', await pg.locator('.world-post').count())
        await pg.locator('.world-post .post-head-text').first.click(); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=O+'4-opened-reels.png')
        print('errors', errs); await b.close()
asyncio.run(main())
