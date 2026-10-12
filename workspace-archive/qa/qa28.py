import asyncio
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v28/'
async def login(b, user, pw):
    c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5)
    pg = await c.new_page(); pg.errs=[]; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.goto(B); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.setItem('nx_lang','en')"); await pg.goto(B); await pg.wait_for_timeout(1500)
    await pg.fill('input >> nth=0', user); await pg.fill('input[type="password"]', pw); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
    return pg
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await login(b, 'qa.temp.chat', '<QA_TEMP_PASSWORD>')
        Bp = await login(b, 'official.nexora', '<OFFICIAL_PASSWORD>')
        # A opens chat with official via profile search -> use API: navigate through New message
        await A.locator('.bottom-nav button').nth(2).click(); await A.wait_for_timeout(1500)
        await A.locator('.topbar .icon-btn').last.click(); await A.wait_for_timeout(1000)
        await A.locator('.sheet-search input').fill('official.nexora'); await A.wait_for_timeout(1500)
        await A.locator('.sheet .user-row').first.click(); await A.wait_for_timeout(2500)
        await A.locator('.chat-composer input[dir=auto]').fill('Hello from the QA account'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1500)
        await A.screenshot(path=O+'1-A-sent.png')
        # B opens inbox -> sees conversation with green dot
        await Bp.locator('.bottom-nav button').nth(2).click(); await Bp.wait_for_timeout(2500)
        await Bp.screenshot(path=O+'2-B-inbox.png')
        print('B presence dots', await Bp.locator('.presence-dot').count())
        await Bp.locator('.user-row.conv').first.click(); await Bp.wait_for_timeout(2500)
        print('B header', await Bp.locator('.chat-title span').first.inner_text())
        # B types -> A sees typing
        await Bp.locator('.chat-composer input[dir=auto]').type('Hi! wel', delay=60)
        await A.wait_for_timeout(4500)
        await A.screenshot(path=O+'3-A-seen-typing.png')
        print('A typing', await A.locator('.typing-bubble').count(), 'A header', await A.locator('.chat-title span').first.inner_text())
        await Bp.keyboard.type('come', delay=40); await Bp.keyboard.press('Enter'); await A.wait_for_timeout(4000)
        print('A typing after send', await A.locator('.typing-bubble').count())
        await A.screenshot(path=O+'4-A-after.png')
        await Bp.wait_for_timeout(3500)
        print('B seen label', await Bp.locator('.seen-label').all_inner_texts())
        await Bp.screenshot(path=O+'5-B-seen.png')
        print('errors', A.errs, Bp.errs); await b.close()
asyncio.run(main())
