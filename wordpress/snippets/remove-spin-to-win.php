<?php
/**
 * Remove "Spin to win!" instructional heading from simulator UIs.
 */
add_action('wp_head', function () {
    if (is_admin()) {
        return;
    }
    echo '<style id="sc-hide-spin-to-win">h5.instructions{display:none!important;}</style>';
}, 100);

add_action('wp_footer', function () {
    if (is_admin()) {
        return;
    }
    echo '<script>(function(){function wipe(){document.querySelectorAll("h5.instructions").forEach(function(el){el.remove();});document.querySelectorAll("body *").forEach(function(el){if(el.children.length)return;var t=(el.textContent||"").replace(/\\s+/g," ").trim();if(/^spin\\s*to\\s*win!?$/i.test(t)){el.remove();}});}wipe();document.addEventListener("DOMContentLoaded",wipe);window.addEventListener("load",wipe);setTimeout(wipe,300);setTimeout(wipe,1200);})();</script>';
}, 100);
