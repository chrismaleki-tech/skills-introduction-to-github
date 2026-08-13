<?php
/**
 * Prevent same-player matchups on 1v1 / multi-player simulators.
 */
add_action('wp_ajax_run_simulation', 'sc_reject_duplicate_simulation_players', 0);
add_action('wp_ajax_nopriv_run_simulation', 'sc_reject_duplicate_simulation_players', 0);
function sc_reject_duplicate_simulation_players() {
    if (empty($_POST['players']) || !is_array($_POST['players'])) {
        return;
    }
    $seen = array();
    foreach ($_POST['players'] as $player) {
        $id = is_array($player) ? (string) reset($player) : (string) $player;
        if ($id === '') {
            continue;
        }
        if (isset($seen[$id])) {
            status_header(400);
            echo wp_json_encode(array(
                'error' => 'duplicate_players',
                'message' => 'Choose different players for each side of the matchup.',
            ));
            exit;
        }
        $seen[$id] = true;
    }
}

add_action('wp_enqueue_scripts', function () {
    if (is_admin() || !is_page(array('matchup-simulator', 'multi-matchup-simulator'))) {
        return;
    }

    $js = <<<'JS'
(function ($) {
  if (!$) return;

  function activeContainers() {
    return $('.players-outer-container:not(.not-active)');
  }

  function selectedPlayerIds($except) {
    var ids = [];
    activeContainers().each(function () {
      if ($except && this === $except[0]) return;
      var val = $(this).find('.player-select').val();
      if (val) ids.push(String(val));
    });
    return ids;
  }

  function showDuplicateNotice(msg) {
    var $box = $('#sc-duplicate-player-msg');
    if (!$box.length) {
      $box = $('<div id="sc-duplicate-player-msg" style="display:none;margin:12px auto;max-width:640px;padding:12px 14px;border-radius:8px;background:#fdecec;color:#b3261e;font-weight:700;text-align:center;"></div>');
      var $anchor = $('#player-comparisons .player-comparison-container, #player-comparisons').first();
      if ($anchor.length) $anchor.before($box);
      else $('body').prepend($box);
    }
    $box.text(msg || 'Choose different players for each side of the matchup.').stop(true, true).fadeIn(150);
  }

  function hideDuplicateNotice() {
    $('#sc-duplicate-player-msg').fadeOut(120);
  }

  function hasDuplicateSelections() {
    var seen = {};
    var dup = false;
    activeContainers().each(function () {
      var val = String($(this).find('.player-select').val() || '');
      if (!val) return;
      if (seen[val]) dup = true;
      seen[val] = true;
    });
    return dup;
  }

  function syncDisabledOptions() {
    activeContainers().each(function () {
      var $wrap = $(this);
      var $select = $wrap.find('.player-select');
      if (!$select.length) return;
      var taken = selectedPlayerIds($wrap);
      $select.find('option').each(function () {
        var val = String(this.value || '');
        if (!val) return;
        var shouldDisable = taken.indexOf(val) !== -1;
        if (!!this.disabled !== shouldDisable) {
          this.disabled = shouldDisable;
        }
      });
    });
  }

  function firstAvailableId($select, taken) {
    var found = null;
    $select.find('option').each(function () {
      if (found) return;
      var val = String(this.value || '');
      if (val && taken.indexOf(val) === -1) found = val;
    });
    return found;
  }

  function goToPlayer($wrap, playerId) {
    var $slider = $wrap.find('.player-slider-container');
    if (!$slider.length || !$slider.hasClass('slick-initialized') || typeof $slider.slick !== 'function') return;
    var idx = $slider.find('.player-container[data-player-id="' + playerId + '"]').data('slick-index');
    if (typeof idx === 'undefined') return;
    try { $slider.slick('slickGoTo', idx); } catch (err) {}
  }

  function enforceUniqueSelection($select) {
    var $wrap = $select.closest('.players-outer-container');
    var val = String($select.val() || '');
    var taken = selectedPlayerIds($wrap);
    if (val && taken.indexOf(val) !== -1) {
      var alt = firstAvailableId($select, taken);
      if (alt) {
        $select.val(alt);
        if ($select.hasClass('select2-hidden-accessible')) {
          $select.trigger('change.select2');
        }
        goToPlayer($wrap, alt);
        $wrap.attr('data-current-player', alt);
      }
      showDuplicateNotice();
    } else {
      hideDuplicateNotice();
    }
    syncDisabledOptions();
    if (hasDuplicateSelections()) {
      $('#run-simulation, #run-simulation-mobile').prop('disabled', true).addClass('disabled');
    }
  }

  $(document).on('select2:selecting', '.player-select', function (e) {
    var id = e.params && e.params.args && e.params.args.data ? String(e.params.args.data.id) : '';
    if (!id) return;
    var $wrap = $(this).closest('.players-outer-container');
    var taken = selectedPlayerIds($wrap);
    if (taken.indexOf(id) !== -1) {
      e.preventDefault();
      showDuplicateNotice();
    }
  });

  $(document).on('select2:select', '.player-select', function () {
    enforceUniqueSelection($(this));
  });

  $(document).on('click', '#run-simulation, #run-simulation-mobile', function (e) {
    if (hasDuplicateSelections()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showDuplicateNotice();
      return false;
    }
    hideDuplicateNotice();
  });

  // Patch spinSlots if defined later.
  function patchSpinSlots() {
    if (typeof window.spinSlots !== 'function' || window.spinSlots._scDupPatched) return;
    var original = window.spinSlots;
    window.spinSlots = function () {
      if (hasDuplicateSelections()) {
        showDuplicateNotice();
        $('#run-simulation, #run-simulation-mobile').removeAttr('disabled').removeClass('disabled');
        return;
      }
      return original.apply(this, arguments);
    };
    window.spinSlots._scDupPatched = true;
  }

  $(function () {
    function whenSlidersReady(cb) {
      var n = 0;
      (function tick() {
        var $sliders = $('.player-slider-container');
        var ready = !$sliders.length || $sliders.filter('.slick-initialized').length === $sliders.length;
        if (ready || n++ > 40) { cb(); return; }
        setTimeout(tick, 50);
      })();
    }
    whenSlidersReady(function () {
      $('.player-select').each(function () { enforceUniqueSelection($(this)); });
      syncDisabledOptions();
      function constrainSliders() {
        $('.player-slider-container.slick-initialized').each(function () {
          var $s = $(this);
          $s.find('.slick-list').css({width: '100%', maxWidth: '100%', overflow: 'hidden'});
          $s.find('.player-image').css({width: '100%', maxWidth: '100%', boxSizing: 'border-box'});
          $s.find('.player-image img').css({width: '100%', maxWidth: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center'});
          try { $s.slick('setPosition'); } catch (err) {}
        });
      }
      constrainSliders();
      setTimeout(constrainSliders, 200);
      setTimeout(constrainSliders, 800);
      $(window).on('scroll.scFix resize.scFix orientationchange.scFix', function () {
        constrainSliders();
      });
      if (window.IntersectionObserver) {
        $('.player-slider-container').each(function () {
          var el = this;
          try {
            new IntersectionObserver(function (entries) {
              if (entries.some(function (e) { return e.isIntersecting; })) constrainSliders();
            }, { threshold: 0.05 }).observe(el);
          } catch (err) {}
        });
      }
    });
    patchSpinSlots();
    setTimeout(patchSpinSlots, 500);
    setTimeout(patchSpinSlots, 1500);
  });
})(window.jQuery);
JS;

    wp_register_script('sc-no-duplicate-players', '', array('jquery'), '1.0.0', true);
    wp_enqueue_script('sc-no-duplicate-players');
    wp_add_inline_script('sc-no-duplicate-players', $js);
}, 30);

add_action('wp_head', function () {
    if (is_admin() || !is_page(array('matchup-simulator', 'multi-matchup-simulator'))) {
        return;
    }
    echo <<<'CSS'
<style id="sc-simulator-layout-fix">
#player-comparisons .player-slider-container,
#player-comparisons-multiple .player-slider-container{
  overflow:hidden!important;
  width:100%!important;
  max-width:100%!important;
  max-height:327px!important;
}
#player-comparisons .slick-list,
#player-comparisons-multiple .slick-list{
  overflow:hidden!important;
  width:100%!important;
  max-width:100%!important;
  max-height:327px!important;
}
#player-comparisons .player-image,
#player-comparisons-multiple .player-image{
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box!important;
}
#player-comparisons .player-image img,
#player-comparisons-multiple .player-image img{
  max-width:100%!important;
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  object-position:top center!important;
}
#player-comparisons .players-container,
#player-comparisons-multiple .players-container{overflow:hidden!important;}
#player-comparisons .player-slider-outer-container,
#player-comparisons-multiple .player-slider-outer-container{
  overflow:hidden!important;
  max-width:100%!important;
  max-height:420px!important;
}
@media(max-width:990px){
  #player-comparisons .player-slider-container,
  #player-comparisons-multiple .player-slider-container,
  #player-comparisons .slick-list,
  #player-comparisons-multiple .slick-list{max-height:280px!important;}
  #player-comparisons .player-slider-outer-container,
  #player-comparisons-multiple .player-slider-outer-container{max-height:340px!important;}
}
@media(max-width:767px){
  #player-comparisons .player-slider-container,
  #player-comparisons-multiple .player-slider-container,
  #player-comparisons .slick-list,
  #player-comparisons-multiple .slick-list{max-height:240px!important;}
  #player-comparisons .player-slider-outer-container,
  #player-comparisons-multiple .player-slider-outer-container{max-height:300px!important;}
}
#matchup-history.simulation-page .matchup-history-container,
#matchup-history .matchup-history-container{
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
#matchup-history .matchup-table-outer,
#matchup-history.simulation-page .matchup-history-container #matchup-table,
#matchup-history #matchup-table{
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  overflow:visible!important;
  box-sizing:border-box!important;
}
#matchup-history #matchup-table .result-row{
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  display:block!important;
  box-sizing:border-box!important;
  padding:10px 12px!important;
  white-space:normal!important;
}
#matchup-history #matchup-table .result-row .text,
#matchup-history #matchup-table .result-row .col-md-auto,
#matchup-history #matchup-table .result-row .date{
  display:block!important;
  float:none!important;
  width:100%!important;
  max-width:100%!important;
  white-space:normal!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
}
@media(max-width:782px){
  #matchup-history.simulation-page .matchup-history-container #matchup-table .result-row .date{display:none!important;}
  #player-comparisons .player-slider-container:after,
  #player-comparisons-multiple .player-slider-container:after{
    left:0!important;right:0!important;width:100%!important;box-sizing:border-box!important;
  }
}
</style>
CSS;
}, 40);
