import asyncio, json, urllib.request
from playwright.async_api import async_playwright
B='http://127.0.0.1:5173'; O='/home/user/shots/v30/'; API='http://127.0.0.1:3001/api/'
def api(path, tok=None, body=None, method=None):
    req = urllib.request.Request(API+path, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'))
    req.add_header('content-type','application/json')
    if tok: req.add_header('authorization','Bearer '+tok)
    return json.load(urllib.request.urlopen(req))
async def login(b, user, pw):
    c = await b.new_context(viewport={'width':412,'height':880}, device_scale_factor=1.5)
    pg = await c.new_page(); pg.errs=[]; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: m.type=='error' and pg.errs.append('console: '+m.text[:200]))
    await pg.goto(B); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.setItem('nx_lang','en')"); await pg.goto(B); await pg.wait_for_timeout(1500)
    await pg.fill('input >> nth=0', user); await pg.fill('input[type="password"]', pw); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
    return pg
async def main():
    ta = api('auth/login', body={'identifier':'qa.temp.chat','password':'<QA_TEMP_PASSWORD>'})['token']
    tb = api('auth/login', body={'identifier':'qa.temp.two','password':'<QA_TEMP_PASSWORD>'})['token']
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await login(b, 'qa.temp.chat', '<QA_TEMP_PASSWORD>')
        pre = api('users/qa.temp.chat/posts', ta); pre = pre.get('posts') or pre.get('items') or []
        if not pre:
          await A.locator('button[aria-label="Create"]').first.click(); await A.wait_for_timeout(1200)
          await A.locator('input[type=file]').first.set_input_files('/home/user/shots/testphoto.jpg'); await A.wait_for_timeout(1500)
          await A.screenshot(path=O+'1-edit-normal.png')
          await A.locator('.filter-item', has_text='Clarendon').click(); await A.wait_for_timeout(500)
          await A.screenshot(path=O+'2-clarendon.png')
          await A.locator('.edit-tabs button').nth(1).click(); await A.wait_for_timeout(400)
          await A.screenshot(path=O+'3-adjust.png')
          await A.locator('.adj-list button').first.click(); await A.wait_for_timeout(300)
          await A.locator('.adj-slider input[type=range]').fill('40'); await A.wait_for_timeout(300)
          await A.screenshot(path=O+'4-slider.png')
          print('slider label', await A.locator('.adj-head span').inner_text(), 'filter css', await A.locator('.edit-preview img').evaluate('e => e.style.filter'))
          await A.locator('.adj-btns .strong').click()
          await A.locator('.topbar .text-link').click(); await A.wait_for_timeout(800)
          await A.locator('textarea').fill('QA filter test'); await A.screenshot(path=O+'5-details.png')
          await A.locator('.topbar .text-link').click(); await A.wait_for_timeout(9000)
        posts = api('users/qa.temp.chat/posts', ta)
        post = (posts.get('posts') or posts.get('items'))[0]
        url = post['media'][0]['url']; print('post', post['id'], url[:60])
        from PIL import Image, ImageStat; import io
        up = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert('RGB'); orig = Image.open('/home/user/shots/testphoto.jpg').convert('RGB')
        print('mean orig', [round(x) for x in ImageStat.Stat(orig).mean], 'uploaded', [round(x) for x in ImageStat.Stat(up).mean])
        c1 = api(f"posts/{post['id']}/comments", tb, {'text':'Beautiful colors 😍'})['comment']
        await A.locator('.bottom-nav button').last.click(); await A.wait_for_timeout(2500)
        await A.locator('.grid-item').first.click(); await A.wait_for_timeout(2500)
        await A.screenshot(path=O+'5b-post.png'); await A.locator('button[aria-label="comment"]:visible').first.click(); await A.wait_for_timeout(2000)
        await A.locator('.comment-like').first.click(); await A.wait_for_timeout(1200)
        await A.locator('.comment-actions button', has_text='Reply').first.click(); await A.wait_for_timeout(400)
        print('prefill', await A.locator('.composer input').input_value(), '| bar', await A.locator('.replying-bar span').inner_text())
        await A.locator('.composer input').type('thank you!'); await A.locator('.composer .text-link').click(); await A.wait_for_timeout(2000)
        await A.screenshot(path=O+'6-comments.png')
        print('replies shown', await A.locator('.comment.reply').count(), 'toggle', await A.locator('.view-replies').inner_text())
        await A.locator('.comment.reply').first.dblclick(); await A.wait_for_timeout(1200)
        print('reply liked', await A.locator('.comment.reply .comment-like.on').count())
        await A.locator('.view-replies').click(); await A.wait_for_timeout(400)
        print('after hide', await A.locator('.comment.reply').count(), await A.locator('.view-replies').inner_text())
        await A.screenshot(path=O+'7-collapsed.png')
        cm = api(f"posts/{post['id']}/comments", tb)['comments']
        print('api comments', [(c['text'], c['parentId'], c['likeCount'], c['ownerLiked']) for c in cm])
        Bp = await login(b, 'qa.temp.two', '<QA_TEMP_PASSWORD>')
        await Bp.locator('button[aria-label="Notifications"]').first.click(); await Bp.wait_for_timeout(2500)
        await Bp.screenshot(path=O+'8-B-notifs.png')
        print('B notif texts', await Bp.locator('.notif-text').all_inner_texts())
        # story filter strip
        await Bp.goto(B); await Bp.wait_for_timeout(2500)
        await Bp.locator('.story-plus').first.click(); await Bp.wait_for_timeout(1000)
        await Bp.locator('input[type=file]').first.set_input_files('/home/user/shots/testphoto.jpg'); await Bp.wait_for_timeout(1200)
        await Bp.locator('.filter-strip.dark .filter-item', has_text='Moon').click(); await Bp.wait_for_timeout(500)
        await Bp.screenshot(path=O+'9-story-filter.png')
        print('errors', A.errs, Bp.errs)
        await b.close()
asyncio.run(main())
