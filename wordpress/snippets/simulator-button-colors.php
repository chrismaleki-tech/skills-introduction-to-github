<?php
/**
 * Give the simulator call-to-action buttons the Try Simulator colour scheme.
 *
 * The Try Simulator buttons in the site header and footer are Elementor buttons
 * on the green global colour #48911E: green fill, white label, 2px green border,
 * inverting to a white fill with a green label on hover.
 *
 * The simulator CTAs shipped the inverse of that — white fill, #699E43 label,
 * going green on hover. That covers the theme's .green-button ("Run the
 * simulation" on /matchup-simulator/ and "Run the simulations" on
 * /multi-matchup-simulator/, desktop and mobile) plus the two Elementor buttons
 * the simulators link to each other with ("Multi-Player Simulator" on page 166,
 * "Classic Simulator" on page 3736). They are flipped here so every simulator
 * button reads green with a white label.
 *
 * Colours only: padding, radius, shadow and typography stay as each button
 * already had them. The theme sets .green-button colours with !important, so
 * these overrides need it too; they print after the enqueued stylesheets.
 */
add_action('wp_head', function () {
    if (is_admin()) {
        return;
    }

    echo <<<'CSS'
<style id="sc-simulator-button-colors">
.green-button,
.elementor-166 .elementor-element.elementor-element-e9fa265 .elementor-button,
.elementor-3736 .elementor-element.elementor-element-799f126 .elementor-button{
  background-color:#48911E!important;
  border-color:#48911E!important;
  color:#FFFFFF!important;
}
.green-button:hover,
.green-button:focus,
.elementor-166 .elementor-element.elementor-element-e9fa265 .elementor-button:hover,
.elementor-166 .elementor-element.elementor-element-e9fa265 .elementor-button:focus,
.elementor-3736 .elementor-element.elementor-element-799f126 .elementor-button:hover,
.elementor-3736 .elementor-element.elementor-element-799f126 .elementor-button:focus{
  background-color:#FFFFFF!important;
  border-color:#48911E!important;
  color:#48911E!important;
}
.green-button.disabled,
.green-button.disabled:hover,
.green-button.disabled:focus{
  background-color:#48911E!important;
  border-color:#48911E!important;
  color:#FFFFFF!important;
}
</style>
CSS;
}, 130);
