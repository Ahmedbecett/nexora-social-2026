import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v29/'
async def login(b, user, pw):
    c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5, permissions=['microphone'])
    pg = await c.new_page(); pg.errs=[]; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: m.type=='error' and pg.errs.append('console: '+m.text[:200]))
    await pg.goto(B); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.setItem('nx_lang','en')"); await pg.goto(B); await pg.wait_for_timeout(1500)
    await pg.fill('input >> nth=0', user); await pg.fill('input[type="password"]', pw); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
    return pg
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        A = await login(b, 'qa.temp.chat', '<QA_TEMP_PASSWORD>')
        await A.locator('.bottom-nav button').nth(2).click(); await A.wait_for_timeout(1500)
        await A.locator('.topbar .icon-btn').last.click(); await A.wait_for_timeout(1000)
        await A.locator('.sheet-search input').fill('official.nexora'); await A.wait_for_timeout(1500)
        await A.locator('.sheet .user-row').first.click(); await A.wait_for_timeout(2500)
        await A.screenshot(path=O+'1-composer.png')
        # voice
        await A.locator('.chat-composer button[aria-label="Voice message"]').click(); await A.wait_for_timeout(3200)
        await A.screenshot(path=O+'2-recording.png')
        print('rec time', await A.locator('.rec-time').inner_text(), 'bars', await A.locator('.rec-wave i').count())
        await A.locator('.rec-send').click(); await A.wait_for_timeout(6000)
        print('voice bubbles A', await A.locator('.voice-bubble').count(), 'time', await A.locator('.voice-time').all_inner_texts())
        # video
        await A.locator('.chat-composer input[type=file]').set_input_files('/home/user/shots/testvid.webm'); await A.wait_for_timeout(15000)
        print('video bubbles A', await A.locator('.bubble-video').count())
        # text + edit
        await A.locator('.chat-composer input[dir=auto]').fill('Helo there'); await A.keyboard.press('Enter'); await A.wait_for_timeout(2000)
        await A.screenshot(path=O+'3-A-sent.png')
        bub = A.locator('.bubble', has_text='Helo there').last
        box = await bub.bounding_box()
        await A.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await A.mouse.down(); await A.wait_for_timeout(700); await A.mouse.up(); await A.wait_for_timeout(800)
        await A.screenshot(path=O+'4-menu.png')
        await A.locator('.msg-menu-wrap', has_text='Edit').locator('text=Edit').first.click(); await A.wait_for_timeout(600)
        await A.screenshot(path=O+'5-editing.png')
        await A.locator('.chat-composer input[dir=auto]').fill('Hello there'); await A.keyboard.press('Enter'); await A.wait_for_timeout(2000)
        print('edited labels A', await A.locator('.edited-label').count())
        await A.screenshot(path=O+'6-edited.png')
        # viewer
        await A.locator('.bubble-video').last.click(); await A.wait_for_timeout(2500)
        await A.screenshot(path=O+'7-viewer.png')
        print('viewer', await A.locator('.media-viewer video').count())
        await A.locator('.media-viewer-x').click(); await A.wait_for_timeout(500)
        print('viewer closed', await A.locator('.media-viewer').count()==0)
        # B side
        Bp = await login(b, 'official.nexora', '<OFFICIAL_PASSWORD>')
        await Bp.locator('.bottom-nav button').nth(2).click(); await Bp.wait_for_timeout(2500)
        await Bp.screenshot(path=O+'8-B-inbox.png')
        await Bp.locator('.user-row.conv').first.click(); await Bp.wait_for_timeout(3000)
        print('B voice', await Bp.locator('.voice-bubble').count(), 'B video', await Bp.locator('.bubble-video').count(), 'B edited', await Bp.locator('.edited-label').count())
        await Bp.locator('.voice-play').first.click(); await Bp.wait_for_timeout(1500)
        await Bp.screenshot(path=O+'9-B-playing.png')
        print('B playing time', await Bp.locator('.voice-time').first.inner_text(), 'on bars', await Bp.locator('.voice-wave i.on').count())
        print('errors', A.errs, Bp.errs); await b.close()
asyncio.run(main())
