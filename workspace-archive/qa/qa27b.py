import asyncio, json
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'
async def lp(pg, loc, ms=650):
    bb = await loc.bounding_box(); x=bb['x']+bb['width']/2; y=bb['y']+bb['height']/2
    await pg.mouse.move(x,y); await pg.mouse.down(); await pg.wait_for_timeout(ms); await pg.mouse.up(); await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); c = await b.new_context(viewport={'width':412,'height':880})
        pg = await c.new_page(); log=[]
        async def onresp(r):
            if '/api/message' in r.url:
                try: body = await r.text()
                except: body=''
                log.append((r.request.method, r.url.split('/api/')[1][:60], body[:160]))
        pg.on('response', onresp)
        pg.on('console', lambda m: log.append(('console', m.text)))
        await pg.goto(B); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.setItem('nx_lang','en')"); await pg.goto(B); await pg.wait_for_timeout(1500)
        await pg.fill('input >> nth=0', 'qa.temp.chat'); await pg.fill('input[type="password"]', '<QA_TEMP_PASSWORD>')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
        await pg.locator('.bottom-nav button').nth(2).click(); await pg.wait_for_timeout(2000)
        await pg.locator('.user-row.conv').first.click(); await pg.wait_for_timeout(2500)
        await pg.locator('.chat-composer input[dir=auto]').fill('to be unsent'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        print('before', await pg.locator('.bubble-row.mine .bubble').all_inner_texts())
        log.clear()
        await lp(pg, pg.locator('.bubble-row.mine .bubble').last)
        await pg.locator('.msg-menu-item.danger').click(); await pg.wait_for_timeout(300)
        await pg.locator('.dialog-btn.danger').click()
        await pg.wait_for_timeout(300); print('t+0.3', await pg.locator('.bubble-row.mine .bubble').all_inner_texts())
        await pg.wait_for_timeout(5000); print('t+5', await pg.locator('.bubble-row.mine .bubble').all_inner_texts())
        for l in log: print(l)
        await b.close()
asyncio.run(main())
