<?php
/**
 * Plugin Name: StatCaddy Golf Data
 * Description: Registers the Data Golf player custom post type and its REST-writable
 *              meta fields, so the Data Golf -> CSV -> WordPress pipeline can upsert
 *              rankings / predictions / skill data via the REST API.
 * Version:     1.0.0
 * Author:      StatCaddy pipeline
 * License:     GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

const STATCADDY_DG_CPT = 'dg_player';

/**
 * Meta fields synced from the Data Golf CSVs. Keyed on dg_id (the stable Data Golf
 * player id) which the loader uses as the upsert key. All are exposed in REST so the
 * pipeline can read and write them, and so Elementor/ACF can render them.
 */
function statcaddy_dg_meta_fields(): array
{
    return [
        'dg_id'             => 'integer',
        'country'           => 'string',
        'datagolf_rank'     => 'integer',
        'owgr_rank'         => 'integer',
        'dg_skill_estimate' => 'number',
        'win'               => 'number',
        'top_5'             => 'number',
        'top_10'            => 'number',
        'top_20'            => 'number',
        'make_cut'          => 'number',
        'sg_total'          => 'number',
        'sg_ott'            => 'number',
        'sg_app'            => 'number',
        'sg_arg'            => 'number',
        'sg_putt'           => 'number',
        'event_name'        => 'string',
        'dg_updated_at'     => 'string',
    ];
}

add_action('init', function () {
    register_post_type(STATCADDY_DG_CPT, [
        'label'        => 'Golfers',
        'labels'       => [
            'name'          => 'Golfers',
            'singular_name' => 'Golfer',
        ],
        'public'       => true,
        'show_in_rest' => true,
        'rest_base'    => 'dg_players',
        'menu_icon'    => 'dashicons-groups',
        'supports'     => ['title', 'editor', 'custom-fields', 'thumbnail', 'page-attributes'],
        'has_archive'  => true,
        'rewrite'      => ['slug' => 'golfers'],
    ]);

    foreach (statcaddy_dg_meta_fields() as $key => $type) {
        register_post_meta(STATCADDY_DG_CPT, $key, [
            'type'         => $type,
            'single'       => true,
            'show_in_rest' => true,
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});
