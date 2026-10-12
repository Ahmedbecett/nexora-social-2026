import asyncio, json
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v23/'
VID="(()=>{const v=[...document.querySelectorAll('.reel-video')].find(x=>x.offsetParent);return v?{paused:v.paused,muted:v.muted,t:+v.currentTime.toFixed(2),audio:v.webkitAudioDecodedByteCount,ready:v.readyState,src:v.currentSrc.slice(0,70)}:null})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        c = await b.new_context(viewport={'width':412,'height':900}, device_scale_factor=1.5, is_mobile=True, has_touch=True, timezone_id='Africa/Algiers')
        pg = await c.new_page(); pg.set_default_timeout(20000); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(2000)
        await pg.fill('input >> nth=0', 'ahmedbecetti35+nexora@gmail.com'); await pg.fill('input[type="password"]', '<OFFICIAL_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(3500)
        await pg.locator('.bottom-nav button').nth(1).click(); await pg.wait_for_timeout(1500)
        await pg.locator('.reels-header button').click(); await pg.wait_for_timeout(1200)
        await pg.locator('input[type=file]').first.set_input_files('/home/user/shots/v23/reeltest.webm'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=O+'01-compose.png')
        ta = pg.locator('textarea')
        if await ta.count(): await ta.first.fill('Sound test')
        await pg.locator('button.btn-primary.btn-block').last.click()
        await pg.wait_for_timeout(15000)
        await pg.screenshot(path=O+'02-after-share.png')
        await pg.locator('.bottom-nav button').nth(1).click(); await pg.wait_for_timeout(1000)
        await pg.locator('.bottom-nav button').nth(0).click(); await pg.wait_for_timeout(500)
        await pg.locator('.bottom-nav button').nth(1).click(); await pg.wait_for_timeout(4000)
        r1 = await pg.evaluate(VID); print('reel playing', r1)
        await pg.screenshot(path=O+'03-reel.png')
        # app to background
        await pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(800); print('background', await pg.evaluate(VID))
        await pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(1200); print('resumed', await pg.evaluate(VID))
        # tap to mute
        await pg.mouse.click(200, 400); await pg.wait_for_timeout(800); print('after tap', await pg.evaluate(VID))
        await pg.mouse.click(200, 400); await pg.wait_for_timeout(800); print('after tap2', await pg.evaluate(VID))
        # leave tab -> must pause
        await pg.locator('.bottom-nav button').nth(0).click(); await pg.wait_for_timeout(2500)
        print('reels after leaving tab', await pg.evaluate("[...document.querySelectorAll('video')].map(v=>({cls:v.className,paused:v.paused,muted:v.muted,vis:!!v.offsetParent}))"))
        await pg.screenshot(path=O+'04-feed.png')
        mb = pg.locator('.mute-btn')
        if await mb.count():
            await mb.first.click(); await pg.wait_for_timeout(800)
            print('feed after unmute', await pg.evaluate("[...document.querySelectorAll('.post-media video')].map(v=>({paused:v.paused,muted:v.muted,audio:v.webkitAudioDecodedByteCount}))"))
        r = await pg.evaluate("fetch('/api/reels',{headers:{Authorization:'Bearer '+localStorage.getItem('nx_token')}}).then(r=>r.json())")
        print('api reels', [(x['id'], x['kind'], x['media'][0]['url'][:60]) for x in r['posts']])
        open('/tmp/reel_ids.json','w').write(json.dumps([x['id'] for x in r['posts'] if x['caption']=='Sound test']))
        print('errors', errs)
        await b.close()
asyncio.run(main())
