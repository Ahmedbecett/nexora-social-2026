import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v27/'
async def lp(pg, loc, ms=650):
    bb = await loc.bounding_box(); x=bb['x']+bb['width']/2; y=bb['y']+bb['height']/2
    await pg.mouse.move(x,y); await pg.mouse.down(); await pg.wait_for_timeout(ms); await pg.mouse.up(); await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5)
        pg = await c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.setItem('nx_lang','en')"); await pg.goto(B); await pg.wait_for_timeout(1500)
        await pg.fill('input >> nth=0', 'qa.temp.chat'); await pg.fill('input[type="password"]', '<QA_TEMP_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
        await pg.locator('.bottom-nav button').nth(2).click(); await pg.wait_for_timeout(2500)
        await pg.locator('.user-row.conv').first.click(); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=O+'1-chat.png')
        print('bubble user-select', await pg.evaluate("getComputedStyle(document.querySelector('.bubble')).userSelect"))
        bubbles = pg.locator('.bubble-row:not(.mine) .bubble')
        await lp(pg, bubbles.nth(1))
        print('menu open', await pg.locator('.msg-menu-wrap').count(), 'selection:', await pg.evaluate("String(getSelection())"))
        await pg.screenshot(path=O+'2-menu-theirs.png')
        await pg.locator('.react-more').click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=O+'3-menu-more.png')
        await pg.locator('.react-grid button', has_text='🔥').click(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=O+'4-reacted.png')
        mine = pg.locator('.bubble-row.mine .bubble').last
        await lp(pg, mine)
        await pg.screenshot(path=O+'5-menu-mine.png')
        await pg.locator('.msg-menu-item', has_text='Reply').click(); await pg.wait_for_timeout(400)
        await pg.keyboard.type('Testing reply from the new menu'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=O+'6-replybar.png')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        # swipe to reply on their message
        t = pg.locator('.bubble-row:not(.mine) .bubble').first; bb = await t.bounding_box()
        await pg.mouse.move(bb['x']+20, bb['y']+bb['height']/2); await pg.mouse.down()
        for i in range(1,9): await pg.mouse.move(bb['x']+20+i*10, bb['y']+bb['height']/2); await pg.wait_for_timeout(20)
        await pg.screenshot(path=O+'7-swiping.png')
        await pg.mouse.up(); await pg.wait_for_timeout(400)
        print('reply bar after swipe', await pg.locator('.reply-bar').count())
        await pg.locator('.reply-bar .icon-btn').click()
        # unsend own last message
        await lp(pg, pg.locator('.bubble-row.mine .bubble').last)
        await pg.locator('.msg-menu-item.danger').click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=O+'8-unsend-confirm.png')
        await pg.locator('.dialog-btn.danger').click(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=O+'9-after-unsend.png')
        # pin
        await lp(pg, pg.locator('.bubble-row:not(.mine) .bubble').nth(1))
        await pg.locator('.msg-menu-item', has_text='Pin').click(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=O+'10-pinned.png')
        # light mode
        await pg.evaluate("document.documentElement.setAttribute('data-theme','light')")
        await lp(pg, pg.locator('.bubble-row.mine .bubble').last)
        await pg.screenshot(path=O+'11-light-menu.png')
        print('errors', errs); await b.close()
asyncio.run(main())
