<?php
/**
 * Standardize player headshot framing on 1v1 + multi-player simulators.
 *
 * Source photos vary (some tighter face crops, some full torso). Force every
 * portrait into the same frame with object-fit/cover + top-center focus so
 * faces land in a consistent place.
 *
 * Only .player-image (and the <img> inside it) may be sized here. The
 * .player-container elements are slick slides: slick sizes them and the
 * .slick-track inline, and lays the slides out in one wide row that
 * .slick-list clips. Clamping a slide or the track to width:100% wraps the
 * row into a vertical stack, which pushes every slide except the first one
 * out of the visible window — the selected golfer's portrait then renders as
 * an empty frame.
 */
add_action('wp_head', function () {
    if (is_admin() || !is_page(array('matchup-simulator', 'multi-matchup-simulator'))) {
        return;
    }

    echo <<<'CSS'
<style id="sc-standardize-player-headshots">
#player-comparisons .player-slider-outer-container .player-container .player-image,
#player-comparisons-multiple .player-slider-outer-container .player-container .player-image{
  overflow:hidden!important;
  width:100%!important;
  max-width:100%!important;
  box-sizing:border-box!important;
  height:327px!important;
  max-height:327px!important;
}
#player-comparisons-multiple .players-container .player-slider-outer-container .player-container .player-image{
  height:280px!important;
  max-height:280px!important;
}
@media (max-width:991.98px){
  #player-comparisons .player-slider-outer-container .player-container .player-image,
  #player-comparisons-multiple .player-slider-outer-container .player-container .player-image,
  #player-comparisons-multiple .players-container .player-slider-outer-container .player-container .player-image{
    height:280px!important;
    max-height:280px!important;
  }
}
@media (max-width:767.98px){
  #player-comparisons .player-slider-outer-container .player-container .player-image,
  #player-comparisons-multiple .player-slider-outer-container .player-container .player-image,
  #player-comparisons-multiple .players-container .player-slider-outer-container .player-container .player-image{
    height:240px!important;
    max-height:240px!important;
  }
}
#player-comparisons .player-slider-outer-container .player-container .player-image img,
#player-comparisons-multiple .player-slider-outer-container .player-container .player-image img{
  position:relative!important;
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  height:100%!important;
  margin:0 auto!important;
  object-fit:cover!important;
  object-position:top center!important;
  z-index:1!important;
}
.option-image{
  overflow:hidden!important;
}
.option-image img{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  object-position:top center!important;
}
</style>
CSS;
}, 120);
