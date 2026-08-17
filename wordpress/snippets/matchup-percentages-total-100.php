<?php
/**
 * Make simulator percentages add up to 100.
 *
 * The multi-player simulator gives each player a share of the group, and those shares add up
 * to exactly 100 before they are displayed. Rounding each one to a tenth on its own spends
 * up to half a tenth per player with nothing to reconcile the leftovers, so a three-way can
 * show 99.9 and a six-way 100.2. The wider the group, the more often it happens: totals miss
 * 100 in about a quarter of three-ways and just under half of six-ways.
 *
 * This reconciles the response so the numbers on screen add up. It works on what the
 * simulator already produced rather than recomputing the shares, so it needs nothing from
 * the theme and stays correct if the model behind it changes. Each leftover tenth is moved
 * onto a separate player, largest first, which keeps every number within a tenth of the
 * value the simulator produced and never promotes a different player to winner.
 *
 * Head-to-head totals are fixed upstream instead, in datagolf/deploy_simulator.py: the
 * uploaded counts land on a tenth of a percent so both halves display exactly.
 */

add_action('wp_ajax_run_simulation', 'sc_matchup_percentages_buffer', 0);
add_action('wp_ajax_nopriv_run_simulation', 'sc_matchup_percentages_buffer', 0);

/**
 * The simulator echoes its JSON and exits, so the response is captured on the way out.
 * PHP flushes the buffer through the callback at shutdown even when the handler exits.
 */
function sc_matchup_percentages_buffer()
{
    ob_start('sc_matchup_percentages_reconcile');
}

/**
 * Rewrite a run_simulation response so the win percentages total 100.
 * Anything that is not a list of player rows is passed straight through.
 */
function sc_matchup_percentages_reconcile($body)
{
    $rows = json_decode($body, true);
    if (!is_array($rows) || count($rows) < 2 || array_keys($rows) !== range(0, count($rows) - 1)) {
        return $body;
    }

    $tenths = array();
    foreach ($rows as $row) {
        if (!is_array($row) || !isset($row['win_percent']) || !is_numeric($row['win_percent'])) {
            return $body;  // an error payload, or a shape this does not understand
        }
        $tenths[] = (int) round($row['win_percent'] * 10);
    }

    $adjusted = sc_matchup_allocate_tenths($tenths);
    if ($adjusted === $tenths) {
        return $body;
    }
    foreach ($adjusted as $i => $t) {
        $rows[$i]['win_percent'] = $t / 10;
    }
    return wp_json_encode($rows);
}

/**
 * Spread the leftover tenths so the values total 1000 (i.e. 100.0 percent).
 *
 * Each tenth goes to a different player, largest value first, skipping any move that would
 * hand the win to someone else or push a value outside 0-100. If every candidate is ruled
 * out the remainder is placed anyway, because a total of 100 is the point of the exercise.
 *
 * @param int[] $tenths Percentages multiplied by ten.
 * @return int[] Same order, totalling 1000.
 */
function sc_matchup_allocate_tenths(array $tenths)
{
    $drift = array_sum($tenths) - 1000;
    if ($drift === 0) {
        return $tenths;
    }

    $leader = sc_matchup_leader($tenths);
    $step = $drift > 0 ? -1 : 1;
    $remaining = abs($drift);

    $order = array_keys($tenths);
    usort($order, function ($x, $y) use ($tenths) {
        return $tenths[$y] === $tenths[$x] ? $x - $y : $tenths[$y] - $tenths[$x];
    });

    foreach ($order as $i) {
        if ($remaining === 0) {
            break;
        }
        $candidate = $tenths;
        $candidate[$i] += $step;
        if ($candidate[$i] < 0 || $candidate[$i] > 1000 || sc_matchup_leader($candidate) !== $leader) {
            continue;
        }
        $tenths = $candidate;
        $remaining--;
    }

    while ($remaining > 0) {
        $placed = false;
        foreach ($order as $i) {
            if ($remaining === 0) {
                break;
            }
            if ($tenths[$i] + $step < 0 || $tenths[$i] + $step > 1000) {
                continue;
            }
            $tenths[$i] += $step;
            $remaining--;
            $placed = true;
        }
        if (!$placed) {
            break;  // every value is already pinned at the edge of the range
        }
    }
    return $tenths;
}

/**
 * Index of the winner, matching how the simulator's script picks one: the first value that
 * is strictly greater than everything before it, starting from zero.
 */
function sc_matchup_leader(array $tenths)
{
    $best = 0;
    $leader = null;
    foreach ($tenths as $i => $t) {
        if ($t > $best) {
            $best = $t;
            $leader = $i;
        }
    }
    return $leader;
}
