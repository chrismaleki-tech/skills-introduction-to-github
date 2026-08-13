<?php
/**
 * StatCaddy open access safety net.
 * Ensures simulators work without login even if theme markup still has paywall classes.
 */
add_action('template_redirect', function () {
    if (is_admin()) {
        return;
    }
    ob_start(function ($html) {
        if (!is_string($html) || $html === '') {
            return $html;
        }
        $html = str_replace('no-subscripiton', '', $html);
        $html = preg_replace('#<div class="subscription-notice">.*?</div>#s', '', $html);
        return $html;
    });
});

add_action('wp_ajax_run_simulation', 'statcaddy_open_access_coerce_user', 1);
add_action('wp_ajax_nopriv_run_simulation', 'statcaddy_open_access_coerce_user', 1);
function statcaddy_open_access_coerce_user() {
    if (!isset($_POST['user']) || $_POST['user'] === '' || $_POST['user'] === '0' || $_POST['user'] === 0) {
        // Theme historically used !empty($_POST['user']); "00" is non-empty and casts to int 0.
        $_POST['user'] = '00';
    }
}
