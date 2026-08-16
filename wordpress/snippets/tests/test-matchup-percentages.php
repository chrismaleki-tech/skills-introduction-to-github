<?php
/**
 * Tests for matchup-percentages-total-100.php.
 *
 * Run with:  php wordpress/snippets/tests/test-matchup-percentages.php
 *
 * The snippet is loaded outside WordPress, so the two functions it touches at load time are
 * stubbed below. Everything else under test is plain PHP.
 */

function add_action($hook, $callback, $priority = 10, $args = 1)
{
}

function wp_json_encode($data, $options = 0, $depth = 512)
{
    return json_encode($data, $options, $depth);
}

require __DIR__ . '/../matchup-percentages-total-100.php';

$failures = array();
$checks = 0;

function check($name, $condition, $detail = '')
{
    global $failures, $checks;
    $checks++;
    if (!$condition) {
        $failures[] = $name . ($detail === '' ? '' : "  [$detail]");
    }
}

function response($percents, $prefix = 'p')
{
    $rows = array();
    foreach ($percents as $i => $p) {
        $rows[] = array('player_id' => $prefix . $i, 'player_name' => 'Player ' . $i, 'win_percent' => $p);
    }
    return json_encode($rows);
}

function percents_of($body)
{
    $out = array();
    foreach (json_decode($body, true) as $row) {
        $out[] = (float) $row['win_percent'];
    }
    return $out;
}

function total_of($body)
{
    return round(array_sum(percents_of($body)), 4);
}

function leader_of($percents)
{
    $tenths = array();
    foreach ($percents as $p) {
        $tenths[] = (int) round($p * 10);
    }
    return sc_matchup_leader($tenths);
}

// ── Real responses captured from the live simulator ──────────────────────────
$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/live-simulator-responses.json'), true);
$broken = 0;
foreach ($fixture['cases'] as $n => $case) {
    $before = $case['win_percent'];
    $body = response($before);
    $after = percents_of(sc_matchup_percentages_reconcile($body));
    $label = "live case $n (" . count($before) . " players, shows {$case['total']})";

    check("$label totals 100", round(array_sum($after), 4) === 100.0, 'got ' . array_sum($after));
    check("$label keeps every number within a tenth", max(array_map(function ($a, $b) {
        return abs($a - $b);
    }, $before, $after)) <= 0.1 + 1e-9);
    check("$label keeps the same winner", leader_of($before) === leader_of($after));
    check("$label stays in range", min($after) >= 0 && max($after) <= 100);
    check("$label keeps the running order", array_keys($before) === array_keys($after));

    if ($case['total'] !== 100.0) {
        $broken++;
        check("$label is actually changed", $before !== $after);
    } else {
        check("$label is left alone", sc_matchup_percentages_reconcile($body) === $body);
    }
}
check('the fixture contains responses that do not add up today', $broken > 50, "only $broken");

// ── Worked examples ──────────────────────────────────────────────────────────
check('a three-way showing 99.9 is corrected, on the largest number',
    percents_of(sc_matchup_percentages_reconcile(response(array(26.6, 42.0, 31.3)))) === array(26.6, 42.1, 31.3));
check('a three-way showing 100.1 is corrected',
    percents_of(sc_matchup_percentages_reconcile(response(array(29.4, 25.7, 45.0)))) === array(29.4, 25.7, 44.9));
check('a head-to-head showing 100.1 is corrected',
    total_of(sc_matchup_percentages_reconcile(response(array(61.1, 39.0)))) === 100.0);
check('a six-way showing 100.2 is corrected',
    total_of(sc_matchup_percentages_reconcile(response(array(16.9, 18.8, 12.2, 24.1, 14.1, 14.1)))) === 100.0);
check('a correct response is returned untouched',
    sc_matchup_percentages_reconcile(response(array(25.0, 25.0, 50.0))) === response(array(25.0, 25.0, 50.0)));

// A tenth taken off the top of a tie would hand the win to the next player along.
$tied = sc_matchup_percentages_reconcile(response(array(33.4, 33.4, 33.4)));
check('a tie at the top is not broken by the correction', leader_of(percents_of($tied)) === 0, $tied);
check('the tie case still totals 100', total_of($tied) === 100.0);

// ── Payloads that must pass straight through ─────────────────────────────────
$passthrough = array(
    'an empty body' => '',
    'plain text' => 'not json at all',
    'the duplicate-player error' => '{"error":"duplicate_players","message":"Choose different players."}',
    'a single player' => response(array(100.0)),
    'an empty list' => '[]',
    'a row without a percentage' => '[{"player_id":"1"},{"player_id":"2"}]',
    'a non-numeric percentage' => '[{"win_percent":"n/a"},{"win_percent":"n/a"}]',
    'a JSON object rather than a list' => '{"a":{"win_percent":40},"b":{"win_percent":60}}',
    'null' => 'null',
);
foreach ($passthrough as $label => $body) {
    check("$label is passed through untouched", sc_matchup_percentages_reconcile($body) === $body);
}

// ── Shape of the rewritten payload ───────────────────────────────────────────
$rewritten = json_decode(sc_matchup_percentages_reconcile(response(array(26.6, 42.0, 31.3), 'id')), true);
check('player ids survive the rewrite', $rewritten[1]['player_id'] === 'id1');
check('player names survive the rewrite', $rewritten[2]['player_name'] === 'Player 2');
check('integer percentages are accepted', total_of(sc_matchup_percentages_reconcile(
    '[{"win_percent":47},{"win_percent":53.1}]')) === 100.0);
check('numeric strings are accepted', total_of(sc_matchup_percentages_reconcile(
    '[{"win_percent":"47"},{"win_percent":"53.1"}]')) === 100.0);
check('the full precision the simulator emits is accepted', total_of(sc_matchup_percentages_reconcile(
    '[{"win_percent":25.60000000000000142},{"win_percent":28.5},{"win_percent":45.89999999999999857}]')) === 100.0);

// ── Correcting an already-correct response changes nothing ───────────────────
$once = sc_matchup_percentages_reconcile(response(array(26.6, 42.0, 31.3)));
check('the correction is idempotent', sc_matchup_percentages_reconcile($once) === $once);

// ── Randomised responses ─────────────────────────────────────────────────────
mt_srand(20260816);
$seen = array();
for ($t = 0; $t < 4000; $t++) {
    $size = 2 + $t % 7;
    $raw = array();
    for ($i = 0; $i < $size; $i++) {
        $raw[] = mt_rand(1, 1000) / 10;
    }
    $scale = 100 / array_sum($raw);
    $before = array();
    foreach ($raw as $v) {
        $before[] = round($v * $scale, 1);
    }
    $seen[(string) round(array_sum($before), 4)] = true;
    $after = percents_of(sc_matchup_percentages_reconcile(response($before)));

    check("random $t totals 100", round(array_sum($after), 4) === 100.0, implode(',', $after));
    check("random $t keeps every number within a tenth", max(array_map(function ($a, $b) {
        return abs($a - $b);
    }, $before, $after)) <= 0.1 + 1e-9, implode(',', $before) . ' -> ' . implode(',', $after));
    check("random $t stays in range", min($after) >= 0 && max($after) <= 100);
    check("random $t keeps the same winner", leader_of($before) === leader_of($after), implode(',', $before));
}
check('the random responses included some that do not add up', count($seen) > 1, implode(',', array_keys($seen)));

// ── The allocator on its own ─────────────────────────────────────────────────
check('an exact total is returned unchanged', sc_matchup_allocate_tenths(array(500, 500)) === array(500, 500));
check('everything on one player is left alone', sc_matchup_allocate_tenths(array(1000, 0)) === array(1000, 0));
check('a shortfall against a pinned maximum is still placed',
    array_sum(sc_matchup_allocate_tenths(array(1000, 0, 0))) === 1000);
check('an excess against pinned zeros is still placed',
    array_sum(sc_matchup_allocate_tenths(array(1000, 0, 10))) === 1000);
check('a large drift is spread rather than dumped on one player',
    sc_matchup_allocate_tenths(array(300, 300, 300)) === array(334, 333, 333));
check('the leader is read as the first of equal values', sc_matchup_leader(array(300, 300, 400)) === 2);
check('the first strictly greatest value wins', sc_matchup_leader(array(400, 400, 200)) === 0);
check('an all-zero response has no leader', sc_matchup_leader(array(0, 0)) === null);

// ── Result ───────────────────────────────────────────────────────────────────
if ($failures) {
    echo count($failures) . " of $checks checks failed:\n";
    foreach (array_slice($failures, 0, 20) as $f) {
        echo "  - $f\n";
    }
    if (count($failures) > 20) {
        echo '  ... and ' . (count($failures) - 20) . " more\n";
    }
    exit(1);
}
echo "all $checks checks passed\n";
