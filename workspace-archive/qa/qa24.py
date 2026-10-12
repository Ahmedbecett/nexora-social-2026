import asyncio, json
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v24/'
VID="(()=>{const v=[...document.querySelectorAll('.reel-video')].find(x=>{const r=x.getBoundingClientRect();return r.top>-5&&r.top<50&&x.offsetParent});return v?{paused:v.paused,muted:v.muted,t:+v.currentTime.toFixed(2),ready:v.readyState,err:v.error&&v.error.code,src:v.currentSrc.slice(-50)}:null})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5, is_mobile=True, has_touch=True, locale='ar')
        pg = await c.new_page(); pg.set_default_timeout(20000); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=O+'00-login-dark.png')
        await pg.locator('.theme-toggle').first.click(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=O+'00-login-light.png')
        await pg.locator('.theme-toggle').first.click(); await pg.wait_for_timeout(300)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=O+'01-feed.png')
        await pg.locator('.bottom-nav button').nth(1).click(); await pg.wait_for_timeout(7000)
        print('reel1', await pg.evaluate(VID)); await pg.screenshot(path=O+'02-reels.png')
        # swipe to next
        await pg.evaluate("document.querySelector('.reels').scrollBy(0, document.querySelector('.reels').clientHeight)"); await pg.wait_for_timeout(5000)
        print('reel2', await pg.evaluate(VID)); await pg.screenshot(path=O+'03-reels2.png')
        # like
        await pg.locator('.reel-side button').first.click(); await pg.wait_for_timeout(1500)
        # topic
        await pg.locator('.topic-chips button').nth(2).click(); await pg.wait_for_timeout(6000)
        print('animals', await pg.evaluate(VID)); await pg.screenshot(path=O+'04-animals.png')
        await pg.locator('.reel-side button').nth(2).click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=O+'05-menu.png'); await pg.mouse.click(200,100); await pg.wait_for_timeout(600)
        # search/explore
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(4000)
        await pg.screenshot(path=O+'06-explore.png')
        await pg.locator('.grid-item').nth(1).click(); await pg.wait_for_timeout(5000)
        print('viewer', await pg.evaluate(VID)); await pg.screenshot(path=O+'07-viewer.png')
        await pg.goto(B); await pg.wait_for_timeout(3500)
        # profile + theme toggle
        await pg.locator('.bottom-nav button').last.click(); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=O+'08-profile-dark.png')
        await pg.locator('.profile-header .theme-toggle').click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=O+'09-profile-light.png')
        await pg.locator('.bottom-nav button').nth(0).click(); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=O+'10-feed-light.png')
        await pg.locator('.bottom-nav button').nth(3).click(); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=O+'11-explore-light.png')
        await pg.locator('.bottom-nav button').last.click(); await pg.wait_for_timeout(1000)
        await pg.locator('.profile-header .theme-toggle').click(); await pg.wait_for_timeout(500)
        print('theme now', await pg.evaluate("document.documentElement.dataset.theme"))
        print('errors', errs)
        await b.close()
asyncio.run(main())
