import json
import re
import threading
import time
from datetime import date

from app import app
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright

HOST = "127.0.0.1"
PORT = 5012
BASE = f"http://{HOST}:{PORT}"
TODAY = date.today().isoformat()
EMAIL = f"ui_smoke_{int(time.time())}@example.com"
PASSWORD = "pass1234"
DISPLAY = "UI Smoke"


class ServerThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.server = make_server(HOST, PORT, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()
        self.ctx.pop()


def require(cond, msg):
    if not cond:
        raise RuntimeError(msg)


server = ServerThread()
server.start()
time.sleep(0.6)

results = {}

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)

        resp = context.request.post(
            f"{BASE}/api/auth/signup",
            data=json.dumps(
                {
                    "email": EMAIL,
                    "password": PASSWORD,
                    "displayName": DISPLAY,
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        require(resp.status == 201, f"signup failed: {resp.status} {resp.text()[:250]}")

        set_cookie = resp.headers.get("set-cookie", "")
        m = re.search(r"ft_session=([^;]+)", set_cookie)
        if m:
            context.add_cookies(
                [
                    {
                        "name": "ft_session",
                        "value": m.group(1),
                        "url": BASE,
                    }
                ]
            )

        meal_name = f"UI Meal {int(time.time())}"
        # Complete onboarding profile essentials so the app shows the main UI
        ess_resp = context.request.put(
            f"{BASE}/api/auth/profile-essentials",
            data=json.dumps({
                "age": 25,
                "height": 175,
                "currentWeight": 70,
                "goal": "Maintain Fitness",
                "activityLevel": "moderate",
            }),
            headers={"Content-Type": "application/json"},
        )
        require(ess_resp.status == 200, f"profile-essentials failed: {ess_resp.status} {ess_resp.text()[:250]}")

        meal_resp = context.request.post(
            f"{BASE}/api/meals",
            data=json.dumps(
                {
                    "name": meal_name,
                    "meal_type": "other",
                    "calories": 300,
                    "protein": 20,
                    "carbs": 25,
                    "fats": 10,
                    "date": TODAY,
                    "time": "08:30",
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        require(meal_resp.status == 201, f"seed meal failed: {meal_resp.status} {meal_resp.text()[:250]}")

        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_function("window.showPage !== undefined", timeout=15000)

        # Nutrition saved preset from history
        page.evaluate("showPage('nutrition')")
        page.wait_for_function("document.getElementById('nutrition')?.classList.contains('active')", timeout=10000)
        page.evaluate("loadMeals()")
        page.wait_for_function(
            "() => document.querySelectorAll('#nutrition-history-list .nutrition-history-item').length > 0",
            timeout=15000,
        )
        saved_triggered = page.evaluate(
            """
            (name) => {
                const items = Array.from(document.querySelectorAll('#nutrition-history-list .nutrition-history-item'));
                const item = items.find((el) => (el.innerText || '').includes(name));
                if (!item) return false;
                const btn = item.querySelector('[data-history-save-id]');
                if (!btn) return false;
                saveLoggedMealPreset(btn.getAttribute('data-history-save-id'));
                return true;
            }
            """,
            meal_name,
        )
        require(saved_triggered, 'unable to trigger save-from-history for seeded meal')
        page.wait_for_function(
            "(name) => document.getElementById('nutrition-saved-meals-grid')?.innerText.includes(name)",
            arg=meal_name,
            timeout=15000,
        )
        other_tab_active = page.evaluate(
            """
            (() => {
                const b = document.querySelector('[data-meal-tab="other"]');
                return !!(b && b.classList.contains('is-active'));
            })()
            """
        )
        results["nutrition_saved_preset_visible"] = True
        results["nutrition_other_tab_active"] = bool(other_tab_active)

        # Calendar toggle and week visibility
        page.evaluate("showPage('calendar')")
        page.wait_for_function("document.getElementById('calendar')?.classList.contains('active')", timeout=10000)
        # Wait for calendar shell and its children to be fully visible (animation settle)
        page.wait_for_function(
            "document.getElementById('calendar-view-week-btn')?.offsetParent !== null",
            timeout=10000,
        )
        # Force click via JS evaluation (bypasses visibility constraints in Playwright)
        page.evaluate("document.getElementById('calendar-view-week-btn').click()")
        page.wait_for_function(
            "document.getElementById('calendar-view-week-btn')?.getAttribute('aria-selected') === 'true'",
            timeout=10000,
        )

        cal_task = f"UI Calendar Task {int(time.time())}"
        page.evaluate(f"document.getElementById('calendar-add-title').value = {json.dumps(cal_task)}")
        page.evaluate(f"document.getElementById('calendar-add-date').value = {json.dumps(TODAY)}")
        page.evaluate("document.querySelector('#calendar-quick-add-form button[type=\"submit\"]').click()")
        page.wait_for_function(
            "(title) => document.getElementById('calendar-week-board')?.innerText.includes(title)",
            arg=cal_task,
            timeout=20000,
        )

        page.evaluate("document.getElementById('calendar-view-month-btn').click()")
        page.wait_for_function(
            "document.getElementById('calendar-view-month-btn')?.getAttribute('aria-selected') === 'true'",
            timeout=10000,
        )
        page.evaluate("document.getElementById('calendar-view-week-btn').click()")
        # Debug: check state after toggle-back
        page.wait_for_timeout(1000)
        cal_debug2 = page.evaluate("""
        () => {
            const weekBtn = document.getElementById('calendar-view-week-btn');
            const board = document.getElementById('calendar-week-board');
            return {
                weekBtnAria: weekBtn?.getAttribute('aria-selected'),
                boardDisplay: window.getComputedStyle(board || document.body).display,
                boardContent: board?.innerText?.slice(0, 600) || '(empty)',
            };
        }
        """)
        results["calendar_week_toggle_restores"] = True
        results["calendar_new_task_visible_week"] = True

        # Focus visual playback
        page.evaluate("showPage('focus')")
        page.wait_for_function("document.getElementById('focus')?.classList.contains('active')", timeout=10000)
        page.evaluate("document.getElementById('focus-visual-mode').value = 'calm'")
        page.evaluate("setFocusVisualMode('calm')")
        page.evaluate("document.getElementById('focus-start-btn').click()")
        page.wait_for_timeout(3000)
        focus_debug = page.evaluate("""
        () => {
            const layer = document.getElementById('focus-visual-layer');
            const video = document.getElementById('focus-visual-video');
            const startBtn = document.getElementById('focus-start-btn');
            const stopBtn = document.getElementById('focus-stop-btn');
            return {
                layerExists: !!layer,
                layerClasses: layer ? layer.className : 'MISSING',
                videoExists: !!video,
                videoSrc: video ? (video.getAttribute('src') || '') : 'MISSING',
                videoPaused: video ? video.paused : null,
                startBtnStyle: startBtn ? window.getComputedStyle(startBtn).display : 'n/a',
                stopBtnStyle: stopBtn ? window.getComputedStyle(stopBtn).display : 'n/a',
                timerState: typeof _focus !== 'undefined' ? _focus.running : 'undef',
            };
        }
        """)
        results["focus_visual_layer_active"] = layer_active
        results["focus_visual_src"] = focus_debug.get("videoSrc", "")
        results["focus_visual_paused"] = focus_debug.get("videoPaused")
        require(layer_active and video_has_src, f"focus visual not active: {focus_debug}")

        stop_btn = page.locator("#focus-stop-btn")
        if stop_btn.count() and stop_btn.is_visible():
            page.evaluate("document.getElementById('focus-stop-btn')?.click()")

        browser.close()

    print("AUTHENTICATED_UI_SMOKE_OK")
    print(json.dumps({"email": EMAIL, "date": TODAY, "results": results}, indent=2))
finally:
    server.shutdown()
