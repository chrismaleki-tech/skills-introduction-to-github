#!/usr/bin/env python3
"""Apply live StatCaddy UX fixes: switcher clearance + 1v1-first CTAs."""

from __future__ import annotations

import base64
import json
import os
import ssl
import time
import urllib.error
import urllib.request

WP_URL = os.environ["WP_URL"].rstrip("/")
USER = os.environ["WP_USERNAME"]
APP = os.environ["WP_APP_PASSWORD"].replace(" ", "")
CREDS = base64.b64encode(f"{USER}:{APP}".encode()).decode()
CTX = ssl.create_default_context()
HEADERS = {
    "Authorization": f"Basic {CREDS}",
    "User-Agent": "Mozilla/5.0 StatCaddyAgent/1.0",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

SNIPPET_9_CODE = r'''/**
 * Simulator page switcher at top of page: "Simulators"
 * Default / first option: 1v1 Matchup Simulator
 * Picklist styled like header Try Simulator button (green + white).
 * Extra top clearance so sticky/fixed header does not cover content.
 */
function sc_more_sims_is_target_page() {
    return !is_admin() && is_page(array('matchup-simulator', 'multi-matchup-simulator', 'matchup-history', 'simulator'));
}

function sc_more_sims_get_options() {
    $current = 'simulator';
    if (is_page('matchup-simulator')) {
        $current = 'matchup-simulator';
    } elseif (is_page('multi-matchup-simulator')) {
        $current = 'multi-matchup-simulator';
    } elseif (is_page('matchup-history')) {
        $current = 'matchup-history';
    } elseif (is_page('simulator')) {
        $current = 'simulator';
    }

    return array(
        'current' => $current,
        'options' => array(
            array('slug' => 'matchup-simulator', 'label' => '1v1 Matchup Simulator', 'url' => home_url('/matchup-simulator/')),
            array('slug' => 'multi-matchup-simulator', 'label' => 'Multi-Player Simulator', 'url' => home_url('/multi-matchup-simulator/')),
            array('slug' => 'simulator', 'label' => 'Build Your Own Matchup Model', 'url' => home_url('/simulator/')),
            array('slug' => 'matchup-history', 'label' => 'Matchup History', 'url' => home_url('/matchup-history/')),
        ),
    );
}

function sc_more_sims_render_markup() {
    static $rendered = false;
    if ($rendered || !sc_more_sims_is_target_page()) {
        return;
    }
    $rendered = true;
    $data = sc_more_sims_get_options();
    echo '<div class="sc-more-sims" data-sc-more-sims-mounted="1">';
    echo '<label class="sc-more-sims__label" for="sc-more-sims-select">Simulators</label>';
    echo '<select id="sc-more-sims-select" class="sc-more-sims__select" aria-label="Simulators" onchange="if(this.value){window.location.href=this.value;}">';
    foreach ($data['options'] as $opt) {
        printf(
            '<option value="%s"%s>%s</option>',
            esc_url($opt['url']),
            selected($data['current'], $opt['slug'], false),
            esc_html($opt['label'])
        );
    }
    echo '</select></div>';
}

add_action('wp_head', function () {
    if (!sc_more_sims_is_target_page()) {
        return;
    }
    echo '<style id="sc-more-sims-css">'
        . 'body.page-id-166,body.page-id-3736,body.page-id-4952,body.page-id-1738{scroll-padding-top:120px!important;}'
        . '.sc-more-sims{display:block!important;visibility:visible!important;opacity:1!important;max-width:520px!important;width:calc(100% - 32px)!important;margin:110px auto 22px!important;padding:10px 16px 12px!important;text-align:center!important;position:relative!important;z-index:5!important;font-family:Staatliches,Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif!important;box-sizing:border-box!important;clear:both!important;background:transparent!important;}'
        . '.sc-more-sims__label{display:block!important;visibility:visible!important;opacity:1!important;margin:0 0 12px!important;font-family:Staatliches,Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif!important;font-size:42px!important;line-height:1.05!important;letter-spacing:2px!important;text-transform:none!important;color:#67953F!important;font-weight:600!important;}'
        . '.sc-more-sims__select{display:inline-block!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:420px!important;appearance:none!important;-webkit-appearance:none!important;border:2px solid #67953F!important;border-radius:45px!important;background-color:#67953F!important;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'10\' viewBox=\'0 0 14 10\'%3E%3Cpath fill=\'%23FFFFFF\' d=\'M7 10L0 0h14z\'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:right 18px center!important;padding:13px 55px 13px 55px!important;font-family:Staatliches,Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif!important;font-size:20px!important;font-weight:800!important;letter-spacing:2px!important;text-transform:uppercase!important;color:#FFFFFF!important;cursor:pointer!important;box-shadow:none!important;box-sizing:border-box!important;}'
        . '.sc-more-sims__select:hover,.sc-more-sims__select:focus{background-color:#567C34!important;border-color:#567C34!important;color:#FFFFFF!important;outline:none!important;}'
        . '.sc-more-sims__select option{background-color:#FFFFFF!important;color:#292929!important;font-weight:600!important;}'
        . 'body.page-id-166 .elementor-location-single,body.page-id-3736 .elementor-location-single,body.page-id-4952 .elementor-location-single,body.page-id-1738 .elementor-location-single,body.page-id-4952 #sc-sim{position:relative!important;z-index:1!important;}'
        . '@media (max-width:767px){.sc-more-sims{margin:92px auto 16px!important;padding:8px 12px!important}.sc-more-sims__label{font-size:28px!important;letter-spacing:1px!important;line-height:1.1!important}.sc-more-sims__select{font-size:15px!important;padding:12px 42px 12px 20px!important;max-width:100%!important;border-radius:28px!important;background-position:right 14px center!important}.page-id-166 .player-select,.page-id-3736 .player-select,.page-id-166 select,.page-id-3736 select{max-width:100%!important;width:100%!important;box-sizing:border-box!important;font-size:16px!important}.page-id-166 button,.page-id-3736 button,.page-id-166 .elementor-button,.page-id-3736 .elementor-button,.page-id-166 input[type=button],.page-id-3736 input[type=button],.page-id-166 input[type=submit],.page-id-3736 input[type=submit]{max-width:100%!important;box-sizing:border-box!important;white-space:normal!important;min-height:44px!important;padding-left:12px!important;padding-right:12px!important;font-size:clamp(13px,3.6vw,16px)!important;line-height:1.2!important}.page-id-166 .slick-list,.page-id-3736 .slick-list{overflow:hidden!important}.page-id-166 .player-container,.page-id-3736 .player-container{max-width:100%!important}}'
        . '</style>';
}, 100);

add_action('elementor/theme/after_do_header', 'sc_more_sims_render_markup', 5);
add_action('wp_body_open', 'sc_more_sims_render_markup', 20);

add_action('wp_footer', function () {
    if (!sc_more_sims_is_target_page()) {
        return;
    }
    sc_more_sims_render_markup();
    $data = sc_more_sims_get_options();
    $json = wp_json_encode($data);
    echo '<script>(function(){'
        . 'var data=' . $json . ';'
        . 'var w=document.querySelector(".sc-more-sims");'
        . 'if(!w){'
        . 'w=document.createElement("div");w.className="sc-more-sims";w.setAttribute("data-sc-more-sims-mounted","1");'
        . 'var label=document.createElement("label");label.className="sc-more-sims__label";label.htmlFor="sc-more-sims-select";label.textContent="Simulators";'
        . 'var select=document.createElement("select");select.id="sc-more-sims-select";select.className="sc-more-sims__select";select.setAttribute("aria-label","Simulators");'
        . 'select.onchange=function(){if(this.value)window.location.href=this.value;};'
        . 'data.options.forEach(function(opt){var o=document.createElement("option");o.value=opt.url;o.textContent=opt.label;if(opt.slug===data.current)o.selected=true;select.appendChild(o);});'
        . 'w.appendChild(label);w.appendChild(select);document.body.appendChild(w);'
        . '}'
        . 'var header=document.querySelector(".elementor-location-header")||document.querySelector("header");'
        . 'if(header&&header.parentNode){header.insertAdjacentElement("afterend",w);}'
        . 'function headerClearance(){'
        . 'var hdr=document.querySelector(".elementor-location-header")||document.querySelector("header");'
        . 'if(!hdr){return 110;}'
        . 'var h=Math.ceil(hdr.getBoundingClientRect().height||0);'
        . 'var sticky=document.querySelector(".elementor-sticky--active,.elementor-sticky__spacer");'
        . 'if(sticky){h=Math.max(h,Math.ceil(sticky.getBoundingClientRect().height||0));}'
        . 'var st=window.getComputedStyle(hdr);'
        . 'if(st.position==="fixed"||st.position==="sticky"){return Math.max(h+28,110);}'
        . 'return Math.max(h+28,96);'
        . '}'
        . 'function bump(){if(!w)return;var clear=headerClearance();w.style.setProperty("margin-top",clear+"px","important");'
        . 'var wb=w.getBoundingClientRect();var hdr=document.querySelector(".elementor-location-header,header");'
        . 'if(hdr){var hb=hdr.getBoundingClientRect();if(wb.top<hb.bottom+12){w.style.setProperty("margin-top",(Math.ceil(hb.height)+36)+"px","important");}}'
        . '}'
        . 'bump();window.addEventListener("load",bump);window.addEventListener("resize",bump);'
        . 'window.addEventListener("scroll",function(){requestAnimationFrame(bump);},{passive:true});'
        . 'setTimeout(bump,250);setTimeout(bump,1000);'
        . '})();</script>';
}, 20);
'''


def api(method: str, path: str, payload: dict | None = None, retries: int = 6):
    data = None if payload is None else json.dumps(payload).encode()
    for i in range(retries):
        req = urllib.request.Request(
            f"{WP_URL}/wp-json{path}",
            data=data,
            headers=HEADERS,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                body = r.read()
                if body[:1] == b"<":
                    print(f"[warn] captcha on {method} {path}; retry {i + 1}/{retries}")
                    time.sleep(3 + i * 3)
                    continue
                return json.loads(body.decode())
        except urllib.error.HTTPError as e:
            err = e.read()[:300]
            print(f"[warn] HTTP {e.code} on {method} {path}: {err!r}; retry {i + 1}/{retries}")
            time.sleep(3 + i * 3)
        except Exception as e:
            print(f"[warn] {type(e).__name__} on {method} {path}: {e}; retry {i + 1}/{retries}")
            time.sleep(3 + i * 3)
    raise RuntimeError(f"Failed {method} {path}")


def rewrite_sim_urls(obj):
    """Point Try Simulator CTAs at /matchup-simulator/."""
    changed = 0

    def walk(nodes):
        nonlocal changed
        if isinstance(nodes, dict):
            nodes = [nodes]
        for n in nodes:
            settings = n.get("settings") or {}
            text = str(settings.get("text") or settings.get("title") or "")
            link = settings.get("link")
            if isinstance(link, dict):
                url = link.get("url") or ""
                looks_cta = "simulator" in text.lower() or url.rstrip("/").endswith("/simulator")
                if looks_cta and url.rstrip("/").endswith("/simulator"):
                    link["url"] = url.replace("/simulator", "/matchup-simulator")
                    if link["url"].endswith("/matchup-simulator"):
                        link["url"] += "/"
                    changed += 1
            if n.get("elements"):
                walk(n["elements"])

    walk(obj)
    return changed


def update_snippet_9():
    current = api("GET", "/code-snippets/v1/snippets/9")
    updated = api(
        "PUT",
        "/code-snippets/v1/snippets/9",
        {
            "name": current.get("name") or "StatCaddy simulator switcher dropdown",
            "desc": 'Top-of-page "Simulators" picklist; 1v1 first; clears sticky header.',
            "code": SNIPPET_9_CODE,
            "scope": current.get("scope") or "global",
            "active": True,
            "priority": current.get("priority") or 5,
            "tags": current.get("tags") or ["statcaddy", "simulators"],
        },
    )
    print(f"[ok] snippet 9 updated; active={updated.get('active')} modified={updated.get('modified')}")


def update_elementor_post(post_type: str, post_id: int, label: str):
    data = api("GET", f"/wp/v2/{post_type}/{post_id}?context=edit")
    ed = data["meta"]["_elementor_data"]
    if isinstance(ed, str):
        obj = json.loads(ed)
        ed_str_mode = True
    else:
        obj = ed
        ed_str_mode = False
    changed = rewrite_sim_urls(obj)
    if not changed:
        print(f"[ok] {label}: no CTA urls needed changing")
        return
    new_ed = json.dumps(obj, separators=(",", ":")) if ed_str_mode else obj
    # Elementor stores JSON string in meta
    if not isinstance(new_ed, str):
        new_ed = json.dumps(new_ed, separators=(",", ":"))
    payload = {"meta": {"_elementor_data": new_ed}}
    api("POST", f"/wp/v2/{post_type}/{post_id}", payload)
    print(f"[ok] {label}: rewrote {changed} simulator CTA(s) -> /matchup-simulator/")


def rename_public_page():
    page = api("GET", "/wp/v2/pages/4952?context=edit&_fields=id,title")
    title = (page.get("title") or {}).get("raw") or ""
    if "Admin Preview" in title or title.strip() != "Build Your Own Matchup Model":
        api("POST", "/wp/v2/pages/4952", {"title": "Build Your Own Matchup Model"})
        print("[ok] renamed page 4952 title to Build Your Own Matchup Model")
    else:
        print("[ok] page 4952 title already correct")


def main() -> int:
    update_snippet_9()
    time.sleep(2)
    update_elementor_post("elementor_library", 86, "Header template")
    time.sleep(2)
    update_elementor_post("pages", 84, "Home page")
    time.sleep(1)
    rename_public_page()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
