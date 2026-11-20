"""Run against a built local app using Python Playwright and installed Chrome."""
import os

from playwright.sync_api import expect, sync_playwright


def verify(browser, width):
    page = browser.new_page(viewport={"width": width, "height": 820},
                            reduced_motion="reduce" if width < 500 else "no-preference")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    base = os.environ.get("EP_TEST_URL", "http://127.0.0.1:8000")
    page.goto(base + "/earthpedia", wait_until="domcontentloaded")
    page.get_by_label("Search concepts").fill("plant health")
    page.get_by_role("combobox", name="Subject").select_option("Vegetation")
    page.get_by_role("link", name="NDVI", exact=True).click()
    expect(page.get_by_role("heading", name="NDVI", exact=True)).to_be_visible()
    expect(page.get_by_text("From light to a vegetation index")).to_be_visible()
    page.get_by_text("Browse EarthPedia").click()
    expect(page.get_by_label("Search concepts")).to_have_value("plant health")
    page.get_by_label("Search concepts").fill("unfindable term")
    page.get_by_text("Clear search and filters").click()
    page.goto(base, wait_until="domcontentloaded")
    page.get_by_text("New here? Take a tour").click()
    page.get_by_role("combobox", name="Study region").select_option("california-coast")
    page.get_by_label("Investigation topic").select_option("ndvi")
    page.get_by_role("button", name="Start beginner walkthrough").click()
    next_step = page.get_by_role("button", name="Next", exact=True)
    next_step.click()
    expect(page).to_have_url(base + "/earthpedia/ndvi")
    page.get_by_role("button", name="Back", exact=True).click()
    next_step.click()
    page.keyboard.press("Escape")
    page.reload(wait_until="domcontentloaded")
    page.locator(".help-launch").click()
    page.get_by_text("How to use EarthPulse", exact=True).click()
    page.get_by_role("button", name="Resume step 2").click()
    for step in range(2, 12):
        expect(page.locator(".tour-panel small")).to_have_text(f"Step {step} of 12")
        next_step.click()
    page.get_by_role("button", name="Finish").click()
    expect(page).to_have_url(base + "/regions")
    page.locator(".help-launch").click()
    page.get_by_role("button", name="Start page tutorial").click()
    expect(page.locator(".tour-highlight")).to_be_visible()
    next_step.click()
    page.get_by_role("button", name="Restart", exact=True).click()
    expect(page.locator(".tour-panel small")).to_have_text("Step 1 of 3")
    page.locator(".locations-map-frame").evaluate("element => element.remove()")
    expect(page.get_by_text("This view is loading or unavailable.", exact=False)).to_be_visible()
    next_step.click()
    page.get_by_role("button", name="Skip tour").click()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert not errors, errors
    page.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome")
        for size in (1440, 390):
            verify(browser, size)
            print(f"Learning flows passed at {size}px", flush=True)
        browser.close()
