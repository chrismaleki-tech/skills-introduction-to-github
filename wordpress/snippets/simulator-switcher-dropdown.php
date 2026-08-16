<?php
/**
 * Simulator page switcher at top of page: "Simulators"
 * Default / first option: 1v1 Matchup Simulator
 * Full-bleed mobile header + clearance so the switcher is never tucked under.
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

/* Site-wide mobile header: full width, in document flow, no empty dark strip. */
add_action('wp_head', function () {
    if (is_admin()) {
        return;
    }
    echo <<<'CSS'
<style id="sc-mobile-header-fix">
html,body{max-width:100%;}
@media (max-width:1024px){
  html,body{overflow-x:hidden;}
  .elementor-location-header{
    position:relative!important;
    width:100%!important;
    max-width:100%!important;
    left:0!important;
    right:0!important;
  }
  .elementor-location-header .elementor-element-4d6f111{
    position:relative!important;
    width:100%!important;
    max-width:100%!important;
    left:0!important;
    right:0!important;
    min-height:0!important;
    overflow-x:hidden!important;
    background-color:#ffffff!important;
    background-image:none!important;
  }
  .elementor-location-header .elementor-element-d094220,
  .elementor-location-header .elementor-element-080483f{
    width:100%!important;
    max-width:100%!important;
    --container-max-width:100%!important;
    box-sizing:border-box!important;
    margin-left:0!important;
    margin-right:0!important;
  }
  .elementor-location-header .elementor-element-d094220{
    display:none!important;
  }
  .elementor-location-header .elementor-element-080483f{
    flex-direction:row!important;
    flex-wrap:nowrap!important;
    align-items:center!important;
    justify-content:space-between!important;
    min-height:72px!important;
    padding-left:12px!important;
    padding-right:8px!important;
    box-shadow:0 4px 10px rgba(0,0,0,.18)!important;
    position:relative!important;
    top:auto!important;
    inset:auto!important;
    transform:none!important;
  }
  .elementor-location-header .elementor-sticky--active,
  .elementor-location-header .elementor-sticky{
    position:relative!important;
    top:auto!important;
    width:100%!important;
    left:0!important;
    right:0!important;
    transform:none!important;
  }
  .elementor-location-header .elementor-sticky__spacer{
    display:none!important;
    height:0!important;
    min-height:0!important;
  }
  .elementor-location-header .elementor-element-0046473{
    width:150px!important;
    max-width:150px!important;
    flex:0 0 150px!important;
    margin:0!important;
  }
  .elementor-location-header .elementor-element-0046473 img{
    width:150px!important;
    max-width:150px!important;
    height:auto!important;
  }
  .elementor-location-header .elementor-element-3c50790{
    width:auto!important;
    max-width:calc(100% - 150px)!important;
    flex:1 1 auto!important;
    align-items:flex-end!important;
    justify-content:flex-end!important;
    padding-right:12px!important;
  }
  .elementor-location-header .elementor-element-5c2b6fc .elementor-button{
    padding:10px 18px!important;
    font-size:14px!important;
    white-space:nowrap!important;
  }
}
</style>
CSS;
}, 20);

add_action('wp_head', function () {
    if (!sc_more_sims_is_target_page()) {
        return;
    }
    echo <<<'CSS'
<style id="sc-more-sims-css">
body.page-id-166,body.page-id-3736,body.page-id-4952,body.page-id-1738{scroll-padding-top:88px!important;}
.sc-more-sims{display:block!important;visibility:visible!important;opacity:1!important;max-width:520px!important;width:calc(100% - 32px)!important;margin:24px auto 14px!important;padding:12px 16px 12px!important;text-align:center!important;position:relative!important;z-index:5!important;font-family:Staatliches,Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif!important;box-sizing:border-box!important;clear:both!important;background:transparent!important;}
.sc-more-sims__label{display:block!important;visibility:visible!important;opacity:1!important;margin:0 0 12px!important;font-family:Staatliches,Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif!important;font-size:42px!important;line-height:1.05!important;letter-spacing:2px!important;text-transform:none!important;color:#67953F!important;font-weight:600!important;}
.sc-more-sims__select{display:inline-block!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:420px!important;appearance:none!important;-webkit-appearance:none!important;border:2px solid #67953F!important;border-radius:45px!important;background-color:#67953F!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10' viewBox='0 0 14 10'%3E%3Cpath fill='%23FFFFFF' d='M7 10L0 0h14z'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:right 18px center!important;padding:13px 55px 13px 55px!important;font-family:Staatliches,Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif!important;font-size:20px!important;font-weight:800!important;letter-spacing:2px!important;text-transform:uppercase!important;color:#FFFFFF!important;cursor:pointer!important;box-shadow:none!important;box-sizing:border-box!important;}
.sc-more-sims__select:hover,.sc-more-sims__select:focus{background-color:#567C34!important;border-color:#567C34!important;color:#FFFFFF!important;outline:none!important;}
.sc-more-sims__select option{background-color:#FFFFFF!important;color:#292929!important;font-weight:600!important;}
body.page-id-166 .elementor-location-single,body.page-id-3736 .elementor-location-single,body.page-id-4952 .elementor-location-single,body.page-id-1738 .elementor-location-single,body.page-id-4952 #sc-sim{position:relative!important;z-index:1!important;}
@media (min-width:783px){
  .sc-more-sims{margin:84px auto 14px!important;}
}
@media (max-width:782px){
  .elementor-location-header,.elementor-location-header .elementor-element-4d6f111,.elementor-location-header .elementor-element-080483f{
    width:100%!important;max-width:100%!important;--container-max-width:100%!important;left:0!important;right:0!important;
  }
  .elementor-location-header .elementor-element-4d6f111{position:relative!important;background-color:#ffffff!important;background-image:none!important;}
  .elementor-location-header .elementor-element-d094220{display:none!important;}
  .sc-more-sims{margin:0!important;padding:8px 12px 10px!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;}
  .sc-more-sims__label{font-size:28px!important;letter-spacing:1px!important;line-height:1.1!important;}
  .sc-more-sims__select{display:block!important;font-size:15px!important;padding:12px 42px 12px 20px!important;width:100%!important;max-width:100%!important;border-radius:28px!important;background-position:right 14px center!important;box-sizing:border-box!important;}
  .page-id-4952 .sc-header-matchup-title,.page-id-166 .sc-header-matchup-title,.page-id-3736 .sc-header-matchup-title{
    white-space:normal!important;font-size:clamp(14px,4vw,22px)!important;
    max-width:min(52vw,220px)!important;letter-spacing:.5px!important;line-height:1.05!important;
    overflow-wrap:anywhere!important;hyphens:auto!important}
  .page-id-166 #player-comparisons .player-comparison-container.row,
  .page-id-3736 #player-comparisons-multiple .player-comparison-container.row,
  .page-id-166 .player-comparison-container.row.justify-content-between,
  .page-id-3736 .player-comparison-container.row.justify-content-between{
    display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
    align-items:stretch!important;gap:18px!important}
  .page-id-166 #player-comparisons #player1-outer.players-outer-container,
  .page-id-166 #player-comparisons #player2-outer.players-outer-container,
  .page-id-166 #player-comparisons .players-outer-container,
  .page-id-3736 #player-comparisons-multiple #player1-outer.players-outer-container,
  .page-id-3736 #player-comparisons-multiple #player2-outer.players-outer-container,
  .page-id-3736 #player-comparisons-multiple .players-outer-container{
    flex:0 0 auto!important;max-width:100%!important;width:100%!important;
    float:none!important;padding-left:0!important;padding-right:0!important;margin-left:auto!important;margin-right:auto!important}
  .page-id-166 #player-comparisons .player-select,
  .page-id-166 #player-comparisons select.player-select,
  .page-id-166 #player-comparisons .select2-container,
  .page-id-3736 #player-comparisons-multiple .player-select,
  .page-id-3736 #player-comparisons-multiple select.player-select,
  .page-id-3736 #player-comparisons-multiple .select2-container{
    max-width:100%!important;width:100%!important;box-sizing:border-box!important;font-size:16px!important}
  .page-id-166 #player-comparisons .select2-container .select2-selection--single,
  .page-id-3736 #player-comparisons-multiple .select2-container .select2-selection--single{min-height:44px!important}
  .page-id-166 #player-comparisons button,
  .page-id-3736 #player-comparisons-multiple button,
  .page-id-166 #player-comparisons .green-button,
  .page-id-3736 #player-comparisons-multiple .green-button{
    max-width:100%!important;box-sizing:border-box!important;white-space:normal!important;min-height:44px!important}
  .page-id-166 .player-slider-container,.page-id-3736 .player-slider-container,
  .page-id-166 .slick-list,.page-id-3736 .slick-list,
  .page-id-166 .player-image,.page-id-3736 .player-image{
    max-width:100%!important;width:100%!important;box-sizing:border-box!important}
  .page-id-166 .slick-list,.page-id-3736 .slick-list{overflow:hidden!important}
}
</style>
CSS;
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
        . 'var headerRoot=document.querySelector(".elementor-location-header")||document.querySelector("header");'
        . 'if(headerRoot&&headerRoot.parentNode){headerRoot.insertAdjacentElement("afterend",w);}'
        . 'function paintedHeaderBottom(){'
        . 'var root=document.querySelector(".elementor-location-header")||document.querySelector("header");'
        . 'var bottom=0;'
        . 'function consider(el){if(!el)return;var st=window.getComputedStyle(el);if(st.display==="none"||st.visibility==="hidden"||Number(st.opacity)===0)return;var r=el.getBoundingClientRect();if(r.width<2||r.height<2)return;if(r.top<260)bottom=Math.max(bottom,r.bottom);}'
        . 'consider(root);'
        . 'if(root){root.querySelectorAll(".elementor-element-080483f,.elementor-element-4d6f111").forEach(consider);}'
        . 'return bottom;'
        . '}'
        . 'function headerInFlow(){'
        . 'var el=document.querySelector(".elementor-location-header .elementor-element-4d6f111")||document.querySelector(".elementor-location-header");'
        . 'if(!el)return false;'
        . 'var pos=window.getComputedStyle(el).position;'
        . 'return pos==="relative"||pos==="static";'
        . '}'
        . 'function bump(){'
        . 'if(!w)return;'
        . 'if(headerInFlow()){'
        . 'w.style.removeProperty("margin-top");'
        . 'return;'
        . '}'
        . 'if(window.scrollY>8)return;'
        . 'var label=w.querySelector(".sc-more-sims__label")||w;'
        . 'var gap=window.matchMedia("(max-width:782px)").matches?10:24;'
        . 'var need=paintedHeaderBottom()+gap;'
        . 'if(!need)return;'
        . 'var top=label.getBoundingClientRect().top;'
        . 'var deficit=need-top;'
        . 'if(deficit>0.5){'
        . 'var cur=parseFloat(window.getComputedStyle(w).marginTop)||0;'
        . 'w.style.setProperty("margin-top",Math.ceil(cur+deficit)+"px","important");'
        . '}'
        . '}'
        . 'bump();'
        . 'window.addEventListener("load",bump);'
        . 'window.addEventListener("resize",bump);'
        . 'if(window.ResizeObserver){try{new ResizeObserver(bump).observe(headerRoot||document.body);}catch(e){}}'
        . 'setTimeout(bump,50);setTimeout(bump,200);setTimeout(bump,600);setTimeout(bump,1500);'
        . '})();</script>';
}, 20);
